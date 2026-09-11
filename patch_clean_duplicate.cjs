const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

const brokenSection = `      <section className="card testsLogCard">
        <div className="testsLogHeader">
          <h2>Registro de ejecucion</h2>
          <div>
        <p className="testsInfo">Cantidad se usa en lecturas. Valor se usa en escrituras. Validacion define si basta respuesta/cantidad o si se comparan valores exactos.</p>
      </section>`;

if (c.includes(brokenSection)) {
  c = c.replace(brokenSection, '');
  fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
  console.log('Removed broken duplicate section successfully');
} else {
  // Try CRLF normalized
  const cNorm = c.replace(/\r\n/g, '\n');
  const brokenNorm = brokenSection.replace(/\r\n/g, '\n');
  if (cNorm.includes(brokenNorm)) {
    const fixed = cNorm.replace(brokenNorm, '');
    fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', fixed);
    console.log('Removed broken duplicate section (normalized) successfully');
  } else {
    console.log('Could not find broken section');
  }
}
