const { db } = require('./src/database');

const personas = db.prepare('SELECT * FROM personas').all();

console.log(`Found ${personas.length} personas.`);

personas.forEach(p => {
  console.log(`\n--- Persona: ${p.name} ---`);
  console.log(`Description: ${p.description}`);
  console.log(`Active: ${p.active}`);
  
  if (p.template_data) {
    console.log(`Template Data: Yes`);
  } else {
    console.log(`Template Data: No`);
  }
  
  if (p.soul_content && p.soul_content.length > 50) {
    console.log(`Soul Content Preview: ${p.soul_content.substring(0, 50)}...`);
  } else {
    console.log(`Soul Content Preview: ${p.soul_content}`);
  }
});
