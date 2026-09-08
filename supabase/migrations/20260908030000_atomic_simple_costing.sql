-- Custeio simples e atômico: regras, custos mensais e embalagens são salvos juntos.
CREATE OR REPLACE FUNCTION public.save_costing_configuration(
  _company_id uuid,
  _settings jsonb,
  _overheads jsonb DEFAULT '[]'::jsonb,
  _conversions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  basis text := COALESCE(_settings->>'allocation_basis', 'hour');
  hours numeric := COALESCE((_settings->>'monthly_hours')::numeric, 160);
  appointments integer := COALESCE((_settings->>'monthly_appointments')::integer, 100);
  default_margin numeric := COALESCE((_settings->>'default_margin_pct')::numeric, 40);
  min_margin numeric := COALESCE((_settings->>'min_margin_pct')::numeric, 10);
  block_below boolean := COALESCE((_settings->>'block_below_cost')::boolean, true);
  row_data jsonb;
  label_value text;
  from_value text;
  to_value text;
  factor_value numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.is_company_admin(_company_id) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar o custeio';
  END IF;
  IF basis NOT IN ('hour', 'appointment') THEN RAISE EXCEPTION 'Base de rateio inválida'; END IF;
  IF hours <= 0 OR appointments <= 0 THEN
    RAISE EXCEPTION 'Horas e atendimentos mensais devem ser maiores que zero';
  END IF;
  IF default_margin < 0 OR default_margin >= 100 OR min_margin < 0 OR min_margin >= 100 THEN
    RAISE EXCEPTION 'As margens devem ficar entre 0 e 99,99';
  END IF;
  IF jsonb_typeof(COALESCE(_overheads, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(_conversions, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Configuração inválida';
  END IF;

  INSERT INTO public.costing_settings(
    company_id, allocation_basis, monthly_hours, monthly_appointments,
    default_margin_pct, min_margin_pct, block_below_cost
  ) VALUES (
    _company_id, basis, hours, appointments, default_margin, min_margin, block_below
  )
  ON CONFLICT (company_id) DO UPDATE SET
    allocation_basis = EXCLUDED.allocation_basis,
    monthly_hours = EXCLUDED.monthly_hours,
    monthly_appointments = EXCLUDED.monthly_appointments,
    default_margin_pct = EXCLUDED.default_margin_pct,
    min_margin_pct = EXCLUDED.min_margin_pct,
    block_below_cost = EXCLUDED.block_below_cost;

  DELETE FROM public.overhead_costs WHERE company_id = _company_id;
  FOR row_data IN SELECT value FROM jsonb_array_elements(COALESCE(_overheads, '[]'::jsonb))
  LOOP
    label_value := NULLIF(trim(row_data->>'label'), '');
    IF label_value IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.overhead_costs(company_id, label, monthly_cents, include_in_costing)
    VALUES (
      _company_id, label_value,
      GREATEST(0, COALESCE((row_data->>'monthly_cents')::integer, 0)),
      COALESCE((row_data->>'include_in_costing')::boolean, true)
    );
  END LOOP;

  DELETE FROM public.unit_conversions WHERE company_id = _company_id;
  FOR row_data IN SELECT value FROM jsonb_array_elements(COALESCE(_conversions, '[]'::jsonb))
  LOOP
    from_value := lower(NULLIF(trim(row_data->>'from_unit'), ''));
    to_value := lower(NULLIF(trim(row_data->>'to_unit'), ''));
    factor_value := COALESCE((row_data->>'factor')::numeric, 0);
    IF from_value IS NULL OR to_value IS NULL OR factor_value <= 0 THEN CONTINUE; END IF;
    IF from_value = to_value THEN
      RAISE EXCEPTION 'A unidade de compra e a unidade de uso devem ser diferentes';
    END IF;
    INSERT INTO public.unit_conversions(company_id, from_unit, to_unit, factor)
    VALUES (_company_id, from_value, to_value, factor_value);
  END LOOP;

  INSERT INTO public.procedure_audit_log(
    company_id, entity, action, description, new_data, actor_user_id
  ) VALUES (
    _company_id, 'cost', 'updated', 'Configuração de custeio atualizada',
    jsonb_build_object(
      'allocation_basis', basis,
      'overhead_count', jsonb_array_length(COALESCE(_overheads, '[]'::jsonb)),
      'conversion_count', jsonb_array_length(COALESCE(_conversions, '[]'::jsonb))
    ), auth.uid()
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_costing_configuration(uuid,jsonb,jsonb,jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_costing_configuration(uuid,jsonb,jsonb,jsonb)
TO authenticated;

NOTIFY pgrst, 'reload schema';
