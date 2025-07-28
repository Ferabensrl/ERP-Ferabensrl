const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certsDir = path.join(__dirname, 'certs');

// Crear directorio si no existe
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir);
}

console.log('🔐 Generando certificados SSL para desarrollo...');

try {
  // Comando para generar certificados autofirmados
  const command = `openssl req -x509 -newkey rsa:4096 -keyout "${path.join(certsDir, 'key.pem')}" -out "${path.join(certsDir, 'cert.pem')}" -days 365 -nodes -subj "/C=UY/ST=Montevideo/L=Montevideo/O=Feraben SRL/OU=Development/CN=localhost"`;
  
  execSync(command, { stdio: 'inherit' });
  
  console.log('✅ Certificados SSL generados exitosamente!');
  console.log('📁 Ubicación:', certsDir);
  console.log('🚀 Ahora puedes ejecutar "npm run dev" y acceder a https://localhost:5173');
  
} catch (error) {
  console.error('❌ Error generando certificados:', error.message);
  console.log('🔧 Alternativa: Instala mkcert para generar certificados locales de confianza');
  console.log('   npm install -g mkcert');
  console.log('   mkcert -install');
  console.log('   mkcert localhost 127.0.0.1 ::1');
}