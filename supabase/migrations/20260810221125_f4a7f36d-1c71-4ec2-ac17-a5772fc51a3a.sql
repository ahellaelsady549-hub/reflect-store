CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'fawry',
  payment_method text,
  merchant_reference text NOT NULL UNIQUE,
  transaction_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  raw_response jsonb,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX payments_order_id_idx ON public.payments(order_id);
CREATE INDEX payments_status_idx ON public.payments(status);
CREATE UNIQUE INDEX payments_provider_txn_idx ON public.payments(provider, transaction_id) WHERE transaction_id IS NOT NULL;

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
ON public.payments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payments_touch
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payment_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_key text NOT NULL,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (provider, event_key)
);

GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payment events"
ON public.payment_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));