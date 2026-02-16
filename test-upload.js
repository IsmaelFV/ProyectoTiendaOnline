// Test rápido del endpoint de upload
async function test() {
  try {
    const res = await fetch('http://localhost:4321/api/admin/upload-image', { 
      method: 'POST' 
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error de conexión:', e.message);
  }
}
test();
