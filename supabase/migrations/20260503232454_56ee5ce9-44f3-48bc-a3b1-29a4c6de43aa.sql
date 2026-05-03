
-- Clientes: piso, código de puerta, nota de reparto
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS piso text,
  ADD COLUMN IF NOT EXISTS codigo_puerta text,
  ADD COLUMN IF NOT EXISTS nota_reparto text;

-- Pedidos: descuento, ajuste manual, pagos divididos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS descuento numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ajuste numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pagos_split jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Items: marca pagado para split
ALTER TABLE public.items_pedido
  ADD COLUMN IF NOT EXISTS pagado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metodo_pago text;
