const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

const regex = /<\/table>\s*<\/div>\s*<p className="testsInfo">/;

const replacement = `</table>
        </div>
        {editingBits && state.steps[editingBits.index] && (
          <BitEditorModal 
            value={editingBits.field === "value" ? state.steps[editingBits.index].value : state.steps[editingBits.index].expected}
            quantity={Number(state.steps[editingBits.index].quantity) || 1}
            startAddress={state.steps[editingBits.index].address || "0"}
            onClose={() => setEditingBits(null)}
            onApply={(val) => {
              if (editingBits.field === "value") {
                changeValue(editingBits.index, val);
              } else {
                patchStep(editingBits.index, { expected: val });
              }
              setEditingBits(null);
            }}
          />
        )}
        <p className="testsInfo">`;

c = c.replace(regex, replacement);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done injecting modal JSX!');
