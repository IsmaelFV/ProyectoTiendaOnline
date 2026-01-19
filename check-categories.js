import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ufyxfazqqzimthppivzn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeXhmYXpxcXppbXRocHBpdnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1MzQ5MjEsImV4cCI6MjA1MjExMDkyMX0.hY5l4qoWxdEDTYPK9cMNnP4KEqMCOTsb6Vd1bPHtK0w'
);

async function checkCategories() {
  const { data: categories, error } = await supabase
    .from('categories')
    .select('name, slug, level, parent_id, gender_id')
    .eq('is_active', true)
    .order('level')
    .order('display_order');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!categories || categories.length === 0) {
    console.log('No se encontraron categorías');
    return;
  }

  const { data: genders } = await supabase
    .from('genders')
    .select('id, name');

  console.log('=== CATEGORÍAS ACTUALES ===\n');
  
  categories.forEach(c => {
    const gender = genders?.find(g => g.id === c.gender_id)?.name || 'Sin género';
    const indent = c.level === 2 ? '  ↳ ' : '';
    const hasParent = c.parent_id ? 'CON parent' : 'SIN parent';
    console.log(`${indent}${c.name} (${c.slug})`);
    console.log(`   Level: ${c.level} | Género: ${gender} | ${hasParent}`);
    console.log('');
  });
}

checkCategories();
