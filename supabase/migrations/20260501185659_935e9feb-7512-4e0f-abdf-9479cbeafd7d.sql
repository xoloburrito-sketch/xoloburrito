-- Añadir cargo de envío al pedido
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio numeric NOT NULL DEFAULT 0;

-- Cambiar default tipo no necesario; documentamos valores: 'local','domicilio','glovo','just_eat'
-- Cambiar default metodo: 'efectivo','tarjeta','glovo','just_eat'
COMMENT ON COLUMN public.pedidos.tipo IS 'local | domicilio | glovo | just_eat';
COMMENT ON COLUMN public.pedidos.metodo_pago IS 'efectivo | tarjeta | glovo | just_eat';