/**
 * Production Brainfuck EDIFACT to JSON Parser Generator.
 * Clean, deterministic, verified pointer balancing.
 *
 * Run `npm run compile:bf` to regenerate bf/edifact_parser.bf.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const P = 20;

export function emitStr(text: string, currentCell: number, printCell = P): string {
  const moveToP = '>'.repeat(printCell - currentCell);
  const moveBack = '<'.repeat(printCell - currentCell);

  let cur = 0;
  const ops: string[] = [moveToP];
  for (const b of new TextEncoder().encode(text)) {
    const diff = b - cur;
    if (diff > 0) ops.push('+'.repeat(diff));
    else if (diff < 0) ops.push('-'.repeat(-diff));
    ops.push('.');
    cur = b;
  }
  ops.push('[-]');
  ops.push(moveBack);
  return ops.join('');
}

export function buildParser(): string {
  function testEqMacro(target: number, res: number): string {
    const ops: string[] = [];
    ops.push('[> > > > > > > > > > + > + < < < < < < < < < < < -]');
    ops.push('> > > > > > > > > > > [ < < < < < < < < < < < + > > > > > > > > > > > - ]');
    ops.push('<');
    if (target > 0) {
      ops.push('-'.repeat(target));
    }

    if (res > 10) {
      const diffRes = res - 10;
      ops.push('>'.repeat(diffRes) + ' + ' + '<'.repeat(diffRes));
      ops.push('[ ' + '>'.repeat(diffRes) + ' - ' + '<'.repeat(diffRes) + ' [-] ]');
    } else {
      const diffRes = 10 - res;
      ops.push('<'.repeat(diffRes) + ' + ' + '>'.repeat(diffRes));
      ops.push('[ ' + '<'.repeat(diffRes) + ' - ' + '>'.repeat(diffRes) + ' [-] ]');
    }

    ops.push('<'.repeat(10));
    return ops.join('');
  }

  const bf: string[] = [];

  // Init: first_seg (c3) = 1
  bf.push('>>> + <<<');
  bf.push(emitStr('{"segments":[', 0));

  // Read loop:
  bf.push(', [');

  // 1. Escape check: if c4 == 1
  bf.push('>>>> [ <<<< . [-] >>>> [-] ] <<<<');

  // If c0 != 0:
  bf.push('[');

  // Clear c5..c9, c12, c13:
  bf.push('>>>>> [-]>[-]>[-]>[-]>[-] >>> [-]>[-] <<<<<<<<<<<<<');

  // Check \n (10) -> c12
  bf.push(testEqMacro(10, 12));
  // Check \r (13) -> c13
  bf.push(testEqMacro(13, 13));
  // c9 = c12 | c13:
  bf.push('>>>>>>>>>>>> [ < < < + > > > [-] ]');
  bf.push('> [ < < < < + > > > > [-] ]');
  bf.push('<<<<<<<<<<<<<');

  // Check '?' (63) -> c5:
  bf.push(testEqMacro(63, 5));

  // Check '+' (43) -> c6:
  bf.push(testEqMacro(43, 6));

  // Check ':' (58) -> c7:
  bf.push(testEqMacro(58, 7));

  // Check '\'' (39) -> c8:
  bf.push(testEqMacro(39, 8));

  // 1. Whitespace (c9 == 1): consume char
  bf.push('>>>>>>>>> [ [-] < < < < < < < < < [-] > > > > > > > > > ] <<<<<<<<<');

  // 2. '?' (c5 == 1): set escape c4 = 1, consume char
  bf.push('>>>>> [ [-] < + < < < < [-] > > > > > ] <<<<<');

  // 3. '+' (c6 == 1):
  bf.push('>>>>>> [');
  bf.push('  < < < <');
  bf.push('  [ > > > > > > > > + > + < < < < < < < < < - ]');
  bf.push('  > > > > > > > > > [ < < < < < < < < < + > > > > > > > > > - ]');
  bf.push('  <');
  bf.push('  > + <');
  bf.push('  [');
  bf.push('    ' + emitStr('"],["', 10));
  bf.push('    > - <');
  bf.push('    [-]');
  bf.push('  ]');
  bf.push('  >');
  bf.push('  [');
  bf.push('    ' + emitStr('","elements":[["', 11));
  bf.push('    < < < < < < < < < + > > > > > > > > >');
  bf.push('    [-]');
  bf.push('  ]');
  bf.push('  < < < < < < < < < <');
  bf.push('  + <');
  bf.push('  [-] > > > > > > [-]');
  bf.push(']');
  bf.push('<<<<<<');

  // 4. ':' (c7 == 1):
  bf.push('>>>>>>> [');
  bf.push('  ' + emitStr('","', 7));
  bf.push('  [-] < < < < < < < [-] > > > > > > >');
  bf.push('] <<<<<<<');

  // 5. '\'' (c8 == 1):
  bf.push('>>>>>>>> [');
  bf.push('  < < < < < <');
  bf.push('  [ > > > > > > > > + > + < < < < < < < < < - ]');
  bf.push('  > > > > > > > > > [ < < < < < < < < < + > > > > > > > > > - ]');
  bf.push('  <');
  bf.push('  > + <');
  bf.push('  [');
  bf.push('    ' + emitStr('"]]}', 10));
  bf.push('    < < < < < < < < [-] < [-] > > > > > > > > >');
  bf.push('    > - <');
  bf.push('    [-]');
  bf.push('  ]');
  bf.push('  >');
  bf.push('  [');
  bf.push('    ' + emitStr('","elements":[]}', 11));
  bf.push('    < < < < < < < < < < [-] > > > > > > > > > >');
  bf.push('    [-]');
  bf.push('  ]');
  bf.push('  < < < < < < < < < < <');
  bf.push('  [-] > > > > > > > > [-]');
  bf.push(']');
  bf.push('<<<<<<<<');

  // 6. Regular character (c0 != 0):
  bf.push('[');
  bf.push('  > [ > > > > > > > > > + > + < < < < < < < < < < - ]');
  bf.push('  > > > > > > > > > > [ < < < < < < < < < < + > > > > > > > > > > - ]');
  bf.push('  <');
  bf.push('  > > + < <');
  bf.push('  [ > > - < < [-] ]');
  bf.push('  > >');
  bf.push('  [');
  bf.push('    < < +');
  bf.push('    < < < < < < <');
  bf.push('    [');
  bf.push('      ' + emitStr('{"name":"', 3));
  bf.push('      [-]');
  bf.push('      > > > > > > > [-] < < < < < < <');
  bf.push('    ]');
  bf.push('    > > > > > > >');
  bf.push('    [');
  bf.push('      ' + emitStr(',{"name":"', 10));
  bf.push('      [-]');
  bf.push('    ]');
  bf.push('    < < < < < < < < < +');
  bf.push('    > > > > > > > > > > > [-]');
  bf.push('  ]');
  bf.push('  < < < < < < < < < < < <');
  bf.push('  . [-]');
  bf.push(']');

  bf.push(']');

  // Read next byte:
  bf.push(', ]');

  bf.push(emitStr(']}', 0));
  return bf.join('');
}

function main(): void {
  const code = buildParser();
  const pureCode = code.replace(/[^><+\-.,[\]]/g, '');
  const bfDir = new URL('../bf/', import.meta.url);
  mkdirSync(bfDir, { recursive: true });

  const path = new URL('edifact_parser.bf', bfDir);
  writeFileSync(path, pureCode + '\n', 'utf-8');
  console.log(`Generated ${fileURLToPath(path)} (${pureCode.length.toLocaleString('en-US')} ops)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
