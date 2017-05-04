import { StringHandlerUtil } from "@ab/common";

/**
 * @class MappedExpression
 * @see npm @ab/template-processor
 * @see also README.md of this project for an explanation about abtmpl files
 * @author arthmoeros (Arturo Saavedra) artu.saavedra@gmail.com
 * 
 * This Class defines a mapped expression, which are recognized within Artifacter's template
 * engine, it defines the regex for location of normal and iterated mapped expressions and provides
 * a structured interface for the values and configuration that a mapped expression represents
 * 
 */
export class MappedExpression {

	/**
	 * The basic regex that recognizes a "potential" mapped expression, not necessarily a valid one
	 */
	public static readonly regex: RegExp = /(&{.*?})/g;

	/**
	 * A grouped regex that structures into capture groups the representation of a normal mapped expression
	 */
	private static readonly groupedRegex: RegExp = /(&{)(\*)? *(\([a-zA-Z0-9_,]*?\))? *([a-zA-Z0-9_.]*?) *(\?)? *(\"[a-zA-Z0-9_. ]*?\")? *('[a-zA-Z0-9_. ]*?')? *(:)? *(\"[a-zA-Z0-9_. ]*?\")? *('[a-zA-Z0-9_. ]*?')? *(})/g;

	/**
	 * A regex with a sharp (#) prefix, which identifies it as an iterated mapped expression
	 */
	private static readonly iteratedRegex: RegExp = /(&{#)([a-zA-Z0-9_.]*?)(})/g;

	/**
	 * Starting index of the expression where it was found
	 */
	private startIndex: number;

	/**
	 * Ending index of the expression where it was found
	 */
	private endIndex: number;

	/**
	 * Pipe functions found in the expression
	 */
	private pipeFunctions: string[];

	/**
	 * Mapped key found in the expression
	 */
	private mappedKey: string;

	/**
	 * Determines if the expression is a ternary evaluated one
	 */
	private isTernary: boolean;

	/**
	 * Resulting true value of a ternary expression
	 */
	private ternaryTrue: string;

	/**
	 * Resulting false value of a ternary expression
	 */
	private ternaryFalse: string;

	/**
	 * Determines if the expression must have a matching value to put into, if not it should just replace it with an empty string
	 */
	private isOptional: boolean = false;

	/**
	 * Determines if the expression is an iterated one
	 */
	private isIterated: boolean;

	/**
	 * Provides debugging information for abtmpl files development
	 */
	private invalidExprMsg: {
		expr: string,
		lineNum: number,
		colNum: number,
		problem: string
	};

	/**
	 * Constructs a Mapped Expression from a regex exec result, it checks for valid syntax, missing required data and if is an iterated expression
	 * @param foundExpr regex execution result for a potential mapped expression
	 */
	constructor(foundExpr: RegExpExecArray) {
		let capturedGroups: RegExpExecArray = this.checkValidSyntax(foundExpr);
		if (capturedGroups) {
			if (this.isIterated) {
				this.parseIteratedExpr(capturedGroups, foundExpr);
			} else {
				this.parseNormalExpr(capturedGroups, foundExpr);
			}
			this.checkMissingData(foundExpr);
		}
	}

	/**
	 * Determines if mapped expression fulfills correct syntax, also determines if is an iterated one
	 * @param foundExpr regex execution result for a potential mapped expression
	 */
	private checkValidSyntax(foundExpr: RegExpExecArray): RegExpExecArray {
		let regex: RegExp = new RegExp(MappedExpression.groupedRegex);
		let resultVal = regex.exec(foundExpr[0]);
		if (resultVal == null) {
			regex = new RegExp(MappedExpression.iteratedRegex);
			resultVal = regex.exec(foundExpr[0]);
			if (resultVal == null) {
				let lineCol: [number, number] = StringHandlerUtil.locateLineColumnUpToIndex(foundExpr.input, foundExpr.index);
				this.invalidExprMsg = { expr: foundExpr[0], lineNum: lineCol[0], colNum: lineCol[1], problem: "Invalid Syntax" };
			} else {
				this.isIterated = true;
			}
		} else {
			this.isIterated = false;
		}
		return resultVal;
	}

	/**
	 * Parses the regex exec result to a normal Mapped Expression
	 * @param capturedGroups regex exec result of a valid normal Mapped Expression
	 * @param foundExpr original regex exec result of a potential Mapped Expression
	 */
	private parseNormalExpr(capturedGroups: RegExpExecArray, foundExpr: RegExpExecArray) {
		if (capturedGroups[2]) {
			this.isOptional = true;
		}
		if (capturedGroups[3]) {
			this.pipeFunctions = this.parsePipeFunctions(capturedGroups[3]);
		}
		this.mappedKey = capturedGroups[4];
		this.isTernary = capturedGroups[5] == "?";
		if (this.isTernary) {
			this.ternaryTrue = capturedGroups[6];
			if (!this.ternaryTrue) {
				this.ternaryTrue = capturedGroups[7];
			}
			this.ternaryFalse = capturedGroups[9];
			if (!this.ternaryFalse) {
				this.ternaryFalse = capturedGroups[10];
			}
			if (this.ternaryTrue) {
				this.ternaryTrue = this.ternaryTrue.substring(1, this.ternaryTrue.length - 1);
			}
			if (this.ternaryFalse) {
				this.ternaryFalse = this.ternaryFalse.substring(1, this.ternaryFalse.length - 1);
			}
		}
		this.startIndex = foundExpr.index;
		this.endIndex = this.startIndex + foundExpr[0].length;
	}

	/**
	 * Parses the regex exec result to an iterated Mapped Expression
	 * @param capturedGroups regex exec result of a valid iterated Mapped Expression
	 * @param foundExpr original regex exec result of a potential Mapped Expression
	 */
	private parseIteratedExpr(capturedGroups: RegExpExecArray, foundExpr: RegExpExecArray) {
		this.mappedKey = capturedGroups[2];
		this.startIndex = foundExpr.index;
		this.endIndex = this.startIndex + foundExpr[0].length;
	}

	/**
	 * Parses the string containing pipe functions in the mapped expression
	 * @param functions string containing pipe functions to execute
	 */
	private parsePipeFunctions(functions: string): string[] {
		return functions.substring(1, functions.length - 1).split(",");
	}

	/**
	 * Checks if parsed Mapped Expression is missing data, flagges it as invalid if so
	 * @param foundExpr regex execution result for a potential mapped expression
	 */
	private checkMissingData(foundExpr: RegExpExecArray) {
		let problem: string;
		if (!this.mappedKey) {
			problem = "Didn't find a mappedKey in the mapped expression";
		}
		if (this.isTernary && !this.ternaryTrue) {
			problem = "Mapped expression declares a ternary operator but couldn't find resulting value for true outcome";
		}
		if (problem != undefined) {
			let lineCol: [number, number] = StringHandlerUtil.locateLineColumnUpToIndex(foundExpr.input, foundExpr.index);
			this.invalidExprMsg = { expr: foundExpr[0], lineNum: lineCol[0], colNum: lineCol[1], problem: problem };
		};
	}

	/**
	 * Utility method for MappedExpression comparison to be used in an array sort
	 * @param expr1 MappedExpression to compare
	 * @param expr2 MappedExpression to compare
	 */
	public static compareExpr(expr1: MappedExpression, expr2: MappedExpression): number {
		if (expr1.$startIndex < expr2.$startIndex) {
			return -1;
		}
		if (expr1.$startIndex > expr2.$startIndex) {
			return 1;
		}
		return 0;
	}

	public get $startIndex(): number {
		return this.startIndex;
	}

	public get $endIndex(): number {
		return this.endIndex;
	}

	public get $pipeFunctions(): string[] {
		return this.pipeFunctions;
	}

	public get $mappedKey(): string {
		return this.mappedKey;
	}

	public get $isTernary(): boolean {
		return this.isTernary;
	}

	public get $ternaryTrue(): string {
		return this.ternaryTrue;
	}

	public get $ternaryFalse(): string {
		return this.ternaryFalse;
	}

	public get $isIterated(): boolean {
		return this.isIterated;
	}

	public get $isOptional(): boolean {
		return this.isOptional;
	}

	public get $invalidExprMsg(): {
		expr: string,
		lineNum: number,
		colNum: number,
		problem: string
	} {
		return this.invalidExprMsg;
	}

}