export interface CliArgs {
  cmd: "build" | "help";
  input?: string;
  out?: string;
  verbose: boolean;
}

export const USAGE = `ig-topcoat — a modern static site generator for HL7 IG Publisher output

Usage:
  ig-topcoat build -i <publisher-output-dir> -o <site-dir> [--verbose]

Options:
  -i, --input    Path to a built IG Publisher output directory
  -o, --out      Directory to write the redesigned site into
      --verbose  Print per-artifact progress
  -h, --help     Show this help
`;

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { cmd: "help", verbose: false };
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift()!;
    switch (a) {
      case "build":
        args.cmd = "build";
        break;
      case "-i":
      case "--input":
        args.input = rest.shift();
        break;
      case "-o":
      case "--out":
        args.out = rest.shift();
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "-h":
      case "--help":
        return { cmd: "help", verbose: false };
      default:
        throw new Error(`Unknown argument: ${a}\n\n${USAGE}`);
    }
  }
  if (args.cmd === "build") {
    if (!args.input) throw new Error(`build requires -i/--input\n\n${USAGE}`);
    if (!args.out) throw new Error(`build requires -o/--out\n\n${USAGE}`);
  }
  return args;
}
