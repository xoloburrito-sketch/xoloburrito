
-- Categorías
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Productos
CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  ingredientes JSONB NOT NULL DEFAULT '[]'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extras (añadir o modificadores)
CREATE TABLE public.extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'local', -- 'local' | 'domicilio'
  estado TEXT NOT NULL DEFAULT 'pagado', -- 'pendiente' | 'pagado' | 'cancelado'
  metodo_pago TEXT, -- 'efectivo' | 'tarjeta'
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  recibido NUMERIC(10,2),
  cambio NUMERIC(10,2),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Items del pedido
CREATE TABLE public.items_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  modificaciones JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { quitar: ["lechuga"], extras: [{nombre, precio}], notas: "" }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS y dar acceso abierto (uso interno, protegido por PIN en frontend)
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all" ON public.categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.extras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.items_pedido FOR ALL USING (true) WITH CHECK (true);

-- Datos iniciales: categorías
INSERT INTO public.categorias (nombre, orden) VALUES
  ('Burritos', 1),
  ('Croquetas', 2),
  ('Extras', 3),
  ('Bebidas', 4);

-- Productos: burritos (con ingredientes)
WITH cat AS (SELECT id FROM public.categorias WHERE nombre='Burritos')
INSERT INTO public.productos (categoria_id, nombre, precio, ingredientes, orden) VALUES
  ((SELECT id FROM cat), 'Burrito Pastor',     9.90, '["120gr Frijoles","120gr Arroz","30gr Mix lechuga","170gr Pastor","50gr Guacamole","50gr Pico de gallo","20gr Salsa de piña"]'::jsonb, 1),
  ((SELECT id FROM cat), 'Burrito Pollo',      9.90, '["Frijoles","Arroz","Mix lechuga","Tiras Pollo","Guacamole","Pico de gallo","Salsa Cheddar"]'::jsonb, 2),
  ((SELECT id FROM cat), 'Burrito Birria',     9.90, '["Frijoles","Arroz","Mix lechuga","Birria","Guacamole","Pico de gallo","Salsa Consomé"]'::jsonb, 3),
  ((SELECT id FROM cat), 'Burrito Ternera',    9.90, '["Frijoles","Arroz","Mix lechuga","Tiras Ternera","Guacamole","Pico de gallo","Salsa Cheddar"]'::jsonb, 4),
  ((SELECT id FROM cat), 'Burrito Cochinita',  7.00, '["Frijoles","Arroz","Mix lechuga","Cochinita","Guacamole","Pico de gallo","Salsa Habanera"]'::jsonb, 5),
  ((SELECT id FROM cat), 'Burrito Tinga',      9.90, '["Frijoles","Arroz","Mix lechuga","Tinga","Guacamole","Pico de gallo","ChipotleCream"]'::jsonb, 6),
  ((SELECT id FROM cat), 'Burrito Tinga Vegana', 9.90, '["Frijoles","Arroz","Mix lechuga","Tinga Vegana","Guacamole","Pico de gallo","ChipotleCream"]'::jsonb, 7),
  ((SELECT id FROM cat), 'Burrito Básico',     9.90, '["120gr Arroz","50gr Bacon","170gr Pollo","50gr Mozzarella","50gr Cheddar","20gr Miel Mostaza"]'::jsonb, 8),
  ((SELECT id FROM cat), 'Burrito Carnitas',   9.90, '["Frijoles","Arroz","Mix lechuga","Carnitas","Guacamole","Pico de gallo"]'::jsonb, 9),
  ((SELECT id FROM cat), 'Burrito Gobernador', 9.90, '["Frijoles","Arroz","Mix lechuga","Gobernador","Guacamole","Pico de gallo"]'::jsonb, 10);

-- Croquetas
WITH cat AS (SELECT id FROM public.categorias WHERE nombre='Croquetas')
INSERT INTO public.productos (categoria_id, nombre, precio, ingredientes, orden) VALUES
  ((SELECT id FROM cat), 'Croquetas de Cochinita', 7.00, '["Cochinita"]'::jsonb, 1);

-- Extras / modificadores
INSERT INTO public.extras (nombre, precio) VALUES
  ('Extra Guacamole', 1.50),
  ('Extra Queso', 1.00),
  ('Extra Carne', 2.50),
  ('Extra Frijoles', 1.00),
  ('Extra Salsa Habanera', 0.50),
  ('Tortilla de Trigo', 0.00),
  ('Tortilla de Maíz', 0.00);
