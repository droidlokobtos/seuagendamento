GRANT SELECT (id, niche_id, sub_niche_id, name, slug, logo_url, banner_url, app_icon_url,
              primary_color, secondary_color, theme, address, city, state, latitude, longitude,
              phone, whatsapp, status, listed_in_marketplace, short_description, description,
              welcome_message, instagram_url, facebook_url, tiktok_url, website_url,
              show_staff_on_portal, show_reviews_on_portal, amenities, online_booking_enabled,
              min_advance_min, max_advance_days, buffer_min, booking_slot_interval_min,
              deposit_enabled, deposit_type, deposit_value, portal_bg_url, portal_bg_style,
              portal_button_color, portal_text_color, portal_card_style, portal_highlight,
              portal_slogan)
  ON public.companies TO anon;