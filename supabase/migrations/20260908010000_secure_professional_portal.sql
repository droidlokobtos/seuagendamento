-- Painel do profissional: comissões são visíveis para o titular, mas somente
-- administradores e perfis financeiros não-profissionais podem alterá-las.

-- Remove políticas antigas de membro que, por serem permissivas, anulavam as
-- regras por profissional criadas posteriormente.
DROP POLICY IF EXISTS "appt member read" ON public.appointments;
DROP POLICY IF EXISTS "appt member write" ON public.appointments;
DROP POLICY IF EXISTS "aps member read" ON public.appointment_services;
DROP POLICY IF EXISTS "aps member write" ON public.appointment_services;
DROP POLICY IF EXISTS "tb member read" ON public.time_blocks;
DROP POLICY IF EXISTS "tb member write" ON public.time_blocks;

-- Um profissional pode consultar somente clientes presentes em sua própria
-- agenda. Cadastro e edição continuam reservados aos demais perfis autorizados.
DROP POLICY IF EXISTS "cust member read" ON public.customers;
DROP POLICY IF EXISTS "cust member write" ON public.customers;
DROP POLICY IF EXISTS "professional customers read" ON public.customers;
DROP POLICY IF EXISTS "professional customers insert" ON public.customers;
DROP POLICY IF EXISTS "professional customers update" ON public.customers;
DROP POLICY IF EXISTS "professional customers delete" ON public.customers;

CREATE POLICY "professional customers read"
ON public.customers
FOR SELECT TO authenticated
USING (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = customers.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND (
        (cu.role <> 'staff' AND COALESCE((cu.permissions ->> 'clientes')::boolean, false))
        OR (
          cu.role = 'staff'
          AND cu.staff_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.company_id = customers.company_id
              AND a.customer_id = customers.id
              AND a.staff_id = cu.staff_id
          )
        )
      )
  )
);

CREATE POLICY "professional customers insert"
ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = customers.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'clientes_cadastro')::boolean, false)
  )
);

CREATE POLICY "professional customers update"
ON public.customers
FOR UPDATE TO authenticated
USING (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = customers.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'clientes_cadastro')::boolean, false)
  )
)
WITH CHECK (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = customers.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'clientes_cadastro')::boolean, false)
  )
);

CREATE POLICY "professional customers delete"
ON public.customers
FOR DELETE TO authenticated
USING (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = customers.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'clientes')::boolean, false)
      AND COALESCE((cu.permissions ->> 'excluir')::boolean, false)
  )
);

DROP POLICY IF EXISTS "commissions admin read" ON public.commissions;
DROP POLICY IF EXISTS "commissions own read" ON public.commissions;
DROP POLICY IF EXISTS "commissions admin write" ON public.commissions;
DROP POLICY IF EXISTS "commissions admin update" ON public.commissions;
DROP POLICY IF EXISTS "commissions admin delete" ON public.commissions;
DROP POLICY IF EXISTS "permission scoped access" ON public.commissions;
DROP POLICY IF EXISTS "permission scoped commissions" ON public.commissions;
DROP POLICY IF EXISTS "professional commissions read" ON public.commissions;
DROP POLICY IF EXISTS "professional commissions insert" ON public.commissions;
DROP POLICY IF EXISTS "professional commissions update" ON public.commissions;
DROP POLICY IF EXISTS "professional commissions delete" ON public.commissions;

CREATE POLICY "professional commissions read"
ON public.commissions
FOR SELECT TO authenticated
USING (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = commissions.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND COALESCE((cu.permissions ->> 'comissoes')::boolean, false)
      AND (cu.role <> 'staff' OR cu.staff_id = commissions.staff_id)
  )
);

CREATE POLICY "professional commissions insert"
ON public.commissions
FOR INSERT TO authenticated
WITH CHECK (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = commissions.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'comissoes')::boolean, false)
  )
);

CREATE POLICY "professional commissions update"
ON public.commissions
FOR UPDATE TO authenticated
USING (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = commissions.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'comissoes')::boolean, false)
  )
)
WITH CHECK (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = commissions.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'comissoes')::boolean, false)
  )
);

CREATE POLICY "professional commissions delete"
ON public.commissions
FOR DELETE TO authenticated
USING (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = commissions.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'comissoes')::boolean, false)
  )
);

-- O perfil profissional apenas consulta cadastro, serviços e jornada. A gestão
-- desses vínculos continua com o administrador da empresa/Admin Master.
DROP POLICY IF EXISTS "staff member write" ON public.staff;
DROP POLICY IF EXISTS "professional staff write" ON public.staff;
CREATE POLICY "professional staff write"
ON public.staff
FOR ALL TO authenticated
USING (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = staff.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'configuracoes')::boolean, false)
  )
)
WITH CHECK (
  public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = staff.company_id
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role <> 'staff'
      AND COALESCE((cu.permissions ->> 'configuracoes')::boolean, false)
  )
);

DROP POLICY IF EXISTS "ss member write" ON public.staff_services;
DROP POLICY IF EXISTS "internal staff services by permission" ON public.staff_services;
DROP POLICY IF EXISTS "professional staff services write" ON public.staff_services;
CREATE POLICY "professional staff services write"
ON public.staff_services
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.staff s
  WHERE s.id = staff_services.staff_id
    AND (
      public.is_company_admin(s.company_id)
      OR EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.company_id = s.company_id
          AND cu.user_id = auth.uid()
          AND cu.active
          AND cu.role <> 'staff'
          AND (
            COALESCE((cu.permissions ->> 'configuracoes')::boolean, false)
            OR COALESCE((cu.permissions ->> 'servicos')::boolean, false)
          )
      )
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.staff s
  WHERE s.id = staff_services.staff_id
    AND (
      public.is_company_admin(s.company_id)
      OR EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.company_id = s.company_id
          AND cu.user_id = auth.uid()
          AND cu.active
          AND cu.role <> 'staff'
          AND (
            COALESCE((cu.permissions ->> 'configuracoes')::boolean, false)
            OR COALESCE((cu.permissions ->> 'servicos')::boolean, false)
          )
      )
    )
));

DROP POLICY IF EXISTS "ssch member write" ON public.staff_schedules;
DROP POLICY IF EXISTS "staff schedules by permission" ON public.staff_schedules;
DROP POLICY IF EXISTS "professional staff schedules write" ON public.staff_schedules;
CREATE POLICY "professional staff schedules write"
ON public.staff_schedules
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.staff s
  WHERE s.id = staff_schedules.staff_id
    AND (
      public.is_company_admin(s.company_id)
      OR EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.company_id = s.company_id
          AND cu.user_id = auth.uid()
          AND cu.active
          AND cu.role <> 'staff'
          AND COALESCE((cu.permissions ->> 'configuracoes')::boolean, false)
      )
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.staff s
  WHERE s.id = staff_schedules.staff_id
    AND (
      public.is_company_admin(s.company_id)
      OR EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.company_id = s.company_id
          AND cu.user_id = auth.uid()
          AND cu.active
          AND cu.role <> 'staff'
          AND COALESCE((cu.permissions ->> 'configuracoes')::boolean, false)
      )
    )
));

NOTIFY pgrst, 'reload schema';
