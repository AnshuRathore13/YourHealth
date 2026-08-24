const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const p = path.join(routesDir, file);
  let content = fs.readFileSync(p, 'utf8');

  // Fix req.params.id
  content = content.replace(/req\.params\.id(?! as string)/g, '(req.params.id as string)');

  // Fix req.query.* where it's used directly
  content = content.replace(/req\.query\.date(?! as string)/g, '(req.query.date as string)');
  content = content.replace(/req\.query\.status(?! as string)/g, '(req.query.status as string)');
  content = content.replace(/req\.query\.doctorId(?! as string)/g, '(req.query.doctorId as string)');

  // Fix appointments.routes.ts line 36 and 61: user does not exist in type UserInclude
  // The error is because of `include: { user: { select: { name: true } } }` but it should be `include: { patient: { select: { name: true } } }`
  content = content.replace(/include:\s*\{\s*user:\s*\{\s*select:\s*\{\s*name:\s*true\s*\}\s*\}\s*\}/g, 'include: { patient: { select: { name: true } } }');
  content = content.replace(/include:\s*\{\s*user:\s*true\s*\}/g, 'include: { patient: true }');
  
  // Fix doctors.routes.ts line 117: 'passed' does not exist in type
  content = content.replace(/const slots: { time: string; booked: boolean }\[\] = \[\];/g, 'const slots: { time: string; booked: boolean; passed?: boolean }[] = [];');

  // Fix patient.routes.ts line 164: (a as any).doctor?.name
  content = content.replace(/doctor:\s*\(a as any\)\.doctor\?\.name/g, 'doctorName: (a as any).doctor?.name');

  fs.writeFileSync(p, content);
}
console.log('Fixed types in routes');
