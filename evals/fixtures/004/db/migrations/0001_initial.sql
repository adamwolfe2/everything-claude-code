CREATE TABLE bookings (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  customer_email text NOT NULL,
  amount_cents integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
