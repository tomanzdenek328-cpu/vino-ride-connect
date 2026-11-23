CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _role app_role := 'driver'; _code text := NEW.raw_user_meta_data->>'dispatch_code';
BEGIN
IF COALESCE(NEW.raw_user_meta_data->>'requested_role','driver') = 'dispatcher' THEN
  IF _code IS NULL OR encode(sha256(convert_to(_code,'UTF8')),'hex') <> '2ee9c995ec816b218d4f38ab275ae93651193fc4d471134c76f487a4150d0f6e' THEN
    RAISE EXCEPTION 'INVALID_DISPATCH_CODE';
  END IF;
  _role := 'dispatcher';
END IF;
INSERT INTO public.profiles(id,full_name,call_sign) VALUES(NEW.id,COALESCE(NEW.raw_user_meta_data->>'full_name',''),COALESCE(NEW.raw_user_meta_data->>'call_sign',''));
INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,_role);
IF _role = 'driver' THEN INSERT INTO public.driver_locations(driver_id,online) VALUES(NEW.id,false); END IF;
RETURN NEW; END $$;