import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgramMermaid, describeFlow, parseProgramFlow } from '../src/analyzers/programFlow';
import { languageConfigs } from '../src/data/languages';
import { analyzeLocally } from '../src/analyzers/localAnalyzer';
import { buildMermaidSource } from '../src/diagrams/visualContract';

/**
 * Guards for program-specific visuals: different programs must produce different
 * execution-flow diagrams, built from the learner's own structure. Nothing here
 * may ever contain corrected code — labels are the learner's statements only.
 */

test('a linear program parses into its statements in order', () => {
  const flow = parseProgramFlow('name = "Ada"\nprint("Hello " + name)');
  assert.deepEqual(flow.map((node) => node.kind), ['stmt', 'output']);
});

test('imports and preprocessor directives are setup, not steps', () => {
  const flow = parseProgramFlow('#include <stdio.h>\nint x = 1;');
  assert.deepEqual(flow.map((node) => node.kind), ['stmt']);
});

test('a for loop becomes a loop node that owns its body', () => {
  const flow = parseProgramFlow('total = 0\nfor n in numbers:\n    total += n\nprint(total)');
  const loop = flow.find((node) => node.kind === 'loop');
  assert.ok(loop, 'a loop node is present');
  assert.equal(loop.body?.length, 1);
  assert.match(loop.label, /for n in numbers/);
});

test('if/else becomes a branch with both arms', () => {
  const source = 'int main(void) {\n    int x;\n    scanf("%d", &x);\n    if (x > 0) {\n        printf("pos");\n    } else {\n        printf("neg");\n    }\n    return 0;\n}';
  const flow = parseProgramFlow(source);
  const branch = flow.find((node) => node.kind === 'branch');
  assert.ok(branch, 'a branch node is present');
  assert.equal(branch.body?.length, 1);
  assert.equal(branch.elseBody?.length, 1);
  // main() is the entry point, so its body is inlined rather than shown as a definition.
  assert.equal(flow.some((node) => node.kind === 'func'), false);
});

test('a named user function is kept as a definition node', () => {
  const flow = parseProgramFlow('def average(values):\n    return sum(values) / len(values)');
  assert.equal(flow[0].kind, 'func');
  assert.equal(flow[0].label, 'average');
  assert.match(buildProgramMermaid(flow) ?? '', /return sum values \/ len values/);
});

test('branch conditions keep the real comparison operator', () => {
  const python = buildProgramMermaid(parseProgramFlow('if score > 50:\n    print("pass")')
  );
  assert.match(python ?? '', /score is greater than 50/);

  const c = buildProgramMermaid(
    parseProgramFlow('if (sum >= 100) {\n  printf("big");\n}'),
  );
  assert.match(c ?? '', /sum is at least 100/);
});

test('an else-if ladder nests instead of collapsing into one decision', () => {
  const mermaid = buildProgramMermaid(
    parseProgramFlow('if n < 0:\n    print("neg")\nelif n == 0:\n    print("zero")\nelse:\n    print("pos")'),
  );
  assert.ok(mermaid);
  // Three arms, two real decisions, and the final else still present.
  assert.match(mermaid ?? '', /n is less than 0/);
  assert.match(mermaid ?? '', /n equals 0/);
  assert.match(mermaid ?? '', /show: neg/);
  assert.match(mermaid ?? '', /show: pos/);
});

test('input steps name the variable, not the format string', () => {
  const c = buildProgramMermaid(
    parseProgramFlow('scanf("%d", &n);\nprintf("Final sum: %d\\n", n);'),
  );
  assert.match(c ?? '', /read: n/);
  // Output keeps the human-readable literal rather than the format specifiers.
  assert.match(c ?? '', /Final sum/);
  assert.doesNotMatch(c ?? '', /%d/);
});

test('a plain-language summary is produced for the learner flow', () => {
  const summary = describeFlow(
    parseProgramFlow('total = 0\nfor n in numbers:\n    total += n\nprint(total)'),
  );
  assert.match(summary, /loop/i);
  assert.match(summary, /result/i);
  assert.equal(describeFlow([]), '');
});

test('different programs produce different flow diagrams', () => {
  const linear = buildProgramMermaid(parseProgramFlow('a = 1\nb = 2\nprint(a + b)'));
  const looping = buildProgramMermaid(
    parseProgramFlow('total = 0\nfor n in numbers:\n    total += n\nprint(total)'),
    'numbers',
  );
  const branching = buildProgramMermaid(
    parseProgramFlow('if score > 50:\n    print("pass")\nelse:\n    print("fail")'),
  );
  assert.ok(linear && looping && branching);
  assert.notEqual(linear, looping);
  assert.notEqual(looping, branching);
  // Only the branching program draws a decision diamond with two arms.
  assert.match(branching ?? '', /\{"/);
  assert.match(branching ?? '', /-->\|yes\|/);
  assert.match(branching ?? '', /-->\|no\|/);
  // Only the looping program draws a back-edge, labelled with its real condition.
  assert.match(looping ?? '', /keep going while n in numbers\?/);
});

test('flow diagram labels are plain text with no injected structure', () => {
  const mermaid = buildProgramMermaid(
    parseProgramFlow('print("a { b } ] <script>")\nvalue = 3'),
  );
  assert.ok(mermaid);
  // Dangerous markup is stripped from every label.
  assert.doesNotMatch(mermaid ?? '', /<script>/);
  assert.doesNotMatch(mermaid ?? '', /<\/script>/);
});

test('empty source produces no flow diagram', () => {
  assert.equal(buildProgramMermaid(parseProgramFlow('   ')), null);
});

test('each supported language gets a source-specific flow from its own program', () => {
  const examples: Record<string, string> = {
    Python: 'number = int(input("Enter a number: "))\nif number > 0:\n    print("positive")\nelse:\n    print("not positive")',
    JavaScript: 'const number = Number(prompt("Enter a number:"));\nif (number > 0) {\n  console.log("positive");\n} else {\n  console.log("not positive");\n}',
    TypeScript: 'const number: number = Number(prompt("Enter a number:"));\nif (number > 0) {\n  console.log("positive");\n} else {\n  console.log("not positive");\n}',
    HTML: '<!doctype html><html><body><h1>Number check</h1><script>const number = Number(prompt("Enter a number:")); if (number > 0) { console.log("positive"); } else { console.log("not positive"); }</script></body></html>',
    SQL: 'SELECT name FROM learners WHERE score > 50 ORDER BY score DESC;',
    C: '#include <stdio.h>\nint main(void) {\n  int number;\n  scanf("%d", &number);\n  if (number > 0) {\n    printf("positive");\n  } else {\n    printf("not positive");\n  }\n  return 0;\n}',
    'C++': '#include <iostream>\nint main() {\n  int number;\n  std::cin >> number;\n  if (number > 0) {\n    std::cout << "positive";\n  } else {\n    std::cout << "not positive";\n  }\n  return 0;\n}',
    Java: 'import java.util.Scanner;\nclass Main {\n  public static void main(String[] args) {\n    Scanner scanner = new Scanner(System.in);\n    int number = scanner.nextInt();\n    if (number > 0) {\n      System.out.println("positive");\n    } else {\n      System.out.println("not positive");\n    }\n  }\n}',
    'C#': 'class Program {\n  static void Main() {\n    int number = int.Parse(Console.ReadLine());\n    if (number > 0) {\n      Console.WriteLine("positive");\n    } else {\n      Console.WriteLine("not positive");\n    }\n  }\n}',
    Go: 'package main\nimport "fmt"\nfunc main() {\n  var number int\n  fmt.Scanln(&number)\n  if number > 0 {\n    fmt.Println("positive")\n  } else {\n    fmt.Println("not positive")\n  }\n}',
    PHP: '<?php\n$number = (int) fgets(STDIN);\nif ($number > 0) {\n  echo "positive";\n} else {\n  echo "not positive";\n}',
    Ruby: 'number = gets.to_i\nif number > 0\n  puts "positive"\nelse\n  puts "not positive"\nend',
    Rust: 'use std::io;\nfn main() {\n  let mut input = String::new();\n  io::stdin().read_line(&mut input).unwrap();\n  let number: i32 = input.trim().parse().unwrap();\n  if number > 0 {\n    println!("positive");\n  } else {\n    println!("not positive");\n  }\n}',
    Kotlin: 'fun main() {\n  val number = readLine()!!.toInt()\n  if (number > 0) {\n    println("positive")\n  } else {\n    println("not positive")\n  }\n}',
  };
  for (const config of languageConfigs) {
    const source = examples[config.displayName];
    assert.ok(source, `${config.displayName} has a representative input/branch/output program`);
    const flow = parseProgramFlow(source);
    const diagram = buildProgramMermaid(flow);
    assert.ok(diagram, `${config.displayName} produces a flow diagram`);
    if (config.displayName !== 'SQL') {
      assert.ok(flow.some((node) => node.kind === 'input'), `${config.displayName} marks user input`);
      assert.match(diagram, /read: (?:number|input)/, `${config.displayName} names the input value`);
      assert.ok(flow.some((node) => node.kind === 'branch'), `${config.displayName} keeps its decision`);
      assert.match(diagram, /number is greater than 0/, `${config.displayName} shows its real condition`);
      assert.match(diagram, /positive/, `${config.displayName} keeps the program's output labels`);
      const branch = flow.find((node) => node.kind === 'branch');
      assert.ok(branch?.body?.some((node) => node.kind === 'output'), `${config.displayName} links the true arm`);
      assert.ok(branch?.elseBody?.some((node) => node.kind === 'output'), `${config.displayName} links the false arm`);
    }

    const alternative = source
      .replace(/number\s*>\s*0/g, 'number > 10')
      .replace(/score\s*>\s*50/g, 'score > 75')
      .replace(/positive/g, 'greater');
    const alternativeDiagram = buildProgramMermaid(parseProgramFlow(alternative));
    assert.ok(alternativeDiagram, `${config.displayName} produces a second flow diagram`);
    assert.notEqual(diagram, alternativeDiagram, `${config.displayName} flow changes when its source changes`);
  }
});

test('diagram generation prefers parsed source flow over a concept template', () => {
  const analysis = analyzeLocally(
    'type Student = { name: string; score: number };\nconst learner: Student = { name: "Mina", score: 92 };\nconsole.log(learner.name);',
    'TypeScript',
  );
  const diagram = buildMermaidSource(analysis);
  assert.match(diagram ?? '', /learner/);
  assert.match(diagram ?? '', /Mina/);
  assert.doesNotMatch(diagram ?? '', /Read a items value/);
});
