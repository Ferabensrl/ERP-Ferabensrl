# 🏢 ERP Feraben SRL

Sistema ERP completo para gestión empresarial desarrollado con React + TypeScript + Supabase.

## 🚀 Características

- **📱 Scanner de códigos EAN13** - Escaneo con cámara móvil
- **📋 Gestión de Pedidos** - Desde WhatsApp hasta facturación
- **📦 Control de Inventario** - Actualizaciones automáticas de stock
- **🧾 Facturación** - Generación y exportación de facturas
- **📊 Dashboard** - Vista general del negocio
- **💬 WhatsApp Integration** - Conversión automática de mensajes a pedidos

## 🛠️ Tecnologías

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL)
- **UI**: Lucide React Icons, CSS Modules
- **Scanner**: html5-qrcode
- **Export**: XLSX (Excel)

## 🔧 Instalación

```bash
# Clonar repositorio
git clone https://github.com/[usuario]/ERP-feraben-srl.git
cd ERP-feraben-srl

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Ejecutar en desarrollo
npm run dev

# Para usar scanner desde móvil (requiere HTTPS)
npm run dev:https
```

## 🔐 Variables de Entorno

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_key
```

## 📱 Uso del Scanner

- **Localhost**: Funciona con HTTP normal
- **Red/Móvil**: Requiere HTTPS para acceso a cámara
- **Formatos**: Códigos EAN13 compatibles

## 🏗️ Estructura del Proyecto

```
src/
├── components/
│   ├── Dashboard/          # Panel principal
│   ├── Pedidos/           # Gestión de pedidos
│   ├── Inventario/        # Control de stock
│   ├── Facturacion/       # Generación de facturas
│   ├── Scanner/           # Escáner EAN13
│   └── WhatsApp/          # Conversión mensajes
├── lib/
│   └── supabaseClient.ts  # Cliente y funciones DB
└── ...
```

## 📈 Flujo de Trabajo

1. **WhatsApp** → Conversión automática a pedido
2. **Pedidos** → Preparación en depósito
3. **Inventario** → Reducción automática de stock
4. **Facturación** → Generación y exportación

## 🔧 Scripts Disponibles

- `npm run dev` - Desarrollo HTTP
- `npm run dev:host` - Desarrollo con acceso de red
- `npm run dev:https` - Desarrollo HTTPS (para scanner móvil)
- `npm run build` - Build de producción
- `npm run generate-certs` - Generar certificados SSL locales

## 🌐 Despliegue

El proyecto está optimizado para:
- **Vercel** (recomendado)
- **Cloudflare Pages**
- **Netlify**

## 📄 Licencia

Proyecto privado - Feraben SRL © 2025
