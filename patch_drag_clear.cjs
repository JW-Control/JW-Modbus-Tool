const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

c = c.replace(/const \[dragOver, setDragOver\] = useState<'top' \| 'bottom' \| false>\(false\);/, 
  `const [dragOver, setDragOver] = useState<'top' | 'bottom' | false>(false);
  useEffect(() => {
    const clearDrag = () => setDragOver(false);
    window.addEventListener('dragend', clearDrag);
    window.addEventListener('drop', clearDrag);
    return () => {
      window.removeEventListener('dragend', clearDrag);
      window.removeEventListener('drop', clearDrag);
    };
  }, []);`
);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
