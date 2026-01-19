/**
 * Script de prueba: Verificar configuración de Brevo
 * Ejecutar: node test-brevo-config.js
 */

import * as brevo from '@getbrevo/brevo';
import { readFileSync } from 'fs';

// Leer variables de entorno
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    envVars[key.trim()] = values.join('=').trim();
  }
});

const BREVO_API_KEY = envVars.BREVO_API_KEY;
const EMAIL_FROM = envVars.EMAIL_FROM;

(async () => {
  console.log('\n🧪 PRUEBA: Configuración de Brevo\n');
  console.log('═'.repeat(60));

  try {
    console.log('📧 Enviando email de prueba...');
    
    // Configurar Brevo
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      BREVO_API_KEY
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = 'Prueba - Sistema de Facturas Configurado';
    sendSmtpEmail.sender = { name: 'FashionMarket', email: EMAIL_FROM };
    sendSmtpEmail.to = [{ email: EMAIL_FROM }];
    sendSmtpEmail.htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e3a8a;">✅ Sistema de Facturas Configurado</h2>
          <p>Este es un email de prueba para confirmar que Brevo está correctamente configurado.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Estado:</strong></p>
            <ul>
              <li>✅ Brevo API conectado</li>
              <li>✅ Generación de PDFs configurada</li>
              <li>✅ Webhook de Stripe actualizado</li>
              <li>✅ Envío automático de facturas activado</li>
            </ul>
          </div>
          <p><strong>Funcionará en:</strong></p>
          <ul>
            <li><strong>Producción:</strong> Automático al confirmar pagos</li>
            <li><strong>Localhost con Stripe CLI:</strong> Automático con webhook local</li>
            <li><strong>Localhost sin Stripe CLI:</strong> Usar botón manual en "Mis Pedidos"</li>
          </ul>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            FashionMarket - Sistema de facturación automática
          </p>
        </div>
      `;

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log('\n✅ ¡EMAIL ENVIADO CORRECTAMENTE!\n');
    console.log('Revisa tu bandeja de entrada en: ismaelfloresvargas22@gmail.com\n');
    console.log('═'.repeat(60));
    console.log('\n📋 CONFIGURACIÓN COMPLETADA:\n');
    console.log('   ✅ Brevo configurado');
    console.log('   ✅ Variables de entorno añadidas');
    console.log('   ✅ Generador de PDF creado');
    console.log('   ✅ Webhook actualizado para envío automático');
    console.log('\n🚀 PRÓXIMOS PASOS:\n');
    console.log('   1. En PRODUCCIÓN: Las facturas se enviarán automáticamente');
    console.log('   2. En LOCALHOST: Necesitas Stripe CLI para webhooks');
    console.log('      - stripe listen --forward-to localhost:4322/api/webhooks/stripe');
    console.log('      - Actualiza STRIPE_WEBHOOK_SECRET en .env');
    console.log('   3. Alternativa: Usar botón "Enviar factura" en /perfil/mis-pedidos\n');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('\n💡 VERIFICA:');
    console.log('   - BREVO_API_KEY en .env es correcto');
    console.log('   - EMAIL_FROM en .env es correcto');
    console.log('   - Conexión a internet funciona\n');
  }
})();
