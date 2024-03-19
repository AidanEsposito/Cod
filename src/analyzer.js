// The semantic analyzer exports a single function, analyze(match), that
// accepts a grammar match object (the CST) from Ohm and produces the
// internal representation of the program (pretty close to what is usually
// called the AST). This representation also includes entities from the
// standard library, as needed.

import * as core from "./core.js"

const INT = core.intType
const FLOAT = core.floatType
const STRING = core.stringType
const BOOLEAN = core.boolType
const VOID = core.voidType

class Context {
  // Like most statically-scoped languages, Carlos contexts will contain a
  // map for their locally declared identifiers and a reference to the parent
  // context. The parent of the global context is null. In addition, the
  // context records whether analysis is current within a loop (so we can
  // properly check break statements), and reference to the current function
  // (so we can properly check return statements).
  constructor({ parent = null, locals = new Map(), inLoop = false, function: f = null }) {
    Object.assign(this, { parent, locals, inLoop, function: f })
  }
  add(name, entity) {
    this.locals.set(name, entity)
  }
  lookup(name) {
    return this.locals.get(name) || this.parent?.lookup(name)
  }
  static root() {
    return new Context({ locals: new Map(Object.entries(core.standardLibrary)) })
  }
  newChildContext(props) {
    return new Context({ ...this, ...props, parent: this, locals: new Map() })
  }
}

export default function analyze(match) {
  // Track the context manually via a simple variable. The initial context
  // contains the mappings from the standard library. Add to this context
  // as necessary. When needing to descent into a new scope, create a new
  // context with the current context as its parent. When leaving a scope,
  // reset this variable to the parent context.
  let context = Context.root()

  // The single gate for error checking. Pass in a condition that must be true.
  // Use errorLocation to give contextual information about the error that will
  // appear: this should be an object whose "at" property is a parse tree node.
  // Ohm's getLineAndColumnMessage will be used to prefix the error message. This
  // allows any semantic analysis errors to be presented to an end user in the
  // same format as Ohm's reporting of syntax errors.
  function must(condition, message, errorLocation) {
    if (!condition) {
      const prefix = errorLocation.at.source.getLineAndColumnMessage()
      throw new Error(`${prefix}${message}`)
    }
  }

  // Next come a number of carefully named utility functions that keep the
  // analysis code clean and readable. Without these utilities, the analysis
  // code would be cluttered with if-statements and error messages. Each of
  // the utilities accept a parameter that should be an object with an "at"
  // property that is a parse tree node. This is used to provide contextual
  // information in the error message.

  function mustNotAlreadyBeDeclared(name, at) {
    must(!context.lookup(name), `Identifier ${name} already declared`, at)
  }

  function mustHaveBeenFound(entity, name, at) {
    must(entity, `Identifier ${name} not declared`, at)
  }

  function mustHaveNumericType(e, at) {
    must([INT, FLOAT].includes(e.type), "Expected a number", at)
  }

  function mustHaveNumericOrStringType(e, at) {
    must([INT, FLOAT, STRING].includes(e.type), "Expected a number or string", at)
  }

  function mustHaveBooleanType(e, at) {
    must(e.type === BOOLEAN, "Expected a boolean", at)
  }

  function mustHaveIntegerType(e, at) {
    must(e.type === INT, "Expected an integer", at)
  }

  function mustHaveAnArrayType(e, at) {
    must(e.type?.kind === "ArrayType", "Expected an array", at)
  }

  function mustHaveAStructType(e, at) {
    must(e.type?.kind === "StructType", "Expected a struct", at)
  }

  function mustBothHaveTheSameType(e1, e2, at) {
    must(equivalent(e1.type, e2.type), "Operands do not have the same type", at)
  }

  function mustAllHaveSameType(expressions, at) {
    // Used to check the elements of an array expression, and the two
    // arms of a conditional expression, among other scenarios.
    must(
      expressions.slice(1).every((e) => equivalent(e.type, expressions[0].type)),
      "Not all elements have the same type",
      at
    )
  }

  function mustBeAType(e, at) {
    // This is a rather ugly hack
    must(e?.kind.endsWith("Type"), "Type expected", at)
  }

  function mustBeAnArrayType(t, at) {
    must(t?.kind === "ArrayType", "Must be an array type", at)
  }

  function includesAsField(structType, type) {
    // Whether the struct type has a field of type type, directly or indirectly
    return structType.fields.some(
      (field) =>
        field.type === type ||
        (field.type?.kind === "StructType" && includesAsField(field.type, type))
    )
  }

  function mustNotBeSelfContaining(structType, at) {
    const containsSelf = includesAsField(structType, structType)
    must(!containsSelf, "Struct type must not be self-containing", at)
  }

  function equivalent(t1, t2) {
    return (
      t1 === t2 ||
      (t1?.kind === "ArrayType" &&
        t2?.kind === "ArrayType" &&
        equivalent(t1.baseType, t2.baseType)) ||
      (t1?.kind === "FunctionType" &&
        t2?.kind === "FunctionType" &&
        equivalent(t1.returnType, t2.returnType) &&
        t1.paramTypes.length === t2.paramTypes.length &&
        t1.paramTypes.every((t, i) => equivalent(t, t2.paramTypes[i])))
    )
  }

  function assignable(fromType, toType) {
    return (
      toType == ANY ||
      equivalent(fromType, toType) ||
      (fromType?.kind === "FunctionType" &&
        toType?.kind === "FunctionType" &&
        // covariant in return types
        assignable(fromType.returnType, toType.returnType) &&
        fromType.paramTypes.length === toType.paramTypes.length &&
        // contravariant in parameter types
        toType.paramTypes.every((t, i) => assignable(t, fromType.paramTypes[i])))
    )
  }

  function typeDescription(type) {
    switch (type.kind) {
      case "IntType":
        return "int"
      case "FloatType":
        return "float"
      case "StringType":
        return "string"
      case "BoolType":
        return "boolean"
      case "VoidType":
        return "void"
      case "constType":
        return "const"
      case "LetType":
        return "let"
      case "StructType":
        return type.name
      case "FunctionType":
        const paramTypes = type.paramTypes.map(typeDescription).join(", ")
        const returnType = typeDescription(type.returnType)
        return `(${paramTypes})->${returnType}`
      case "ArrayType":
        return `[${typeDescription(type.baseType)}]`
    }
  }

  function mustBeAssignable(e, { toType: type }, at) {
    const message = `Cannot assign a ${typeDescription(e.type)} to a ${typeDescription(
      type
    )}`
    must(assignable(e.type, type), message, at)
  }

  function mustNotBeReadOnly(e, at) {
    must(!e.readOnly, `Cannot assign to constant ${e.name}`, at)
  }

  function mustHaveDistinctFields(type, at) {
    const fieldNames = new Set(type.fields.map((f) => f.name))
    must(fieldNames.size === type.fields.length, "Fields must be distinct", at)
  }

  function mustHaveMember(structType, field, at) {
    must(structType.fields.map((f) => f.name).includes(field), "No such field", at)
  }

  function mustBeInLoop(at) {
    must(context.inLoop, "Break can only appear in a loop", at)
  }

  function mustBeInAFunction(at) {
    must(context.function, "Return can only appear in a function", at)
  }

  function mustBeCallable(e, at) {
    const callable = e?.kind === "StructType" || e.type?.kind === "FunctionType"
    must(callable, "Call of non-function or non-constructor", at)
  }

  function mustNotReturnAnything(f, at) {
    must(f.type.returnType === VOID, "Something should be returned", at)
  }

  function mustReturnSomething(f, at) {
    must(f.type.returnType !== VOID, "Cannot return a value from this function", at)
  }

  function mustBeReturnable(e, { from: f }, at) {
    mustBeAssignable(e, { toType: f.type.returnType }, at)
  }

  function mustHaveCorrectArgumentCount(argCount, paramCount, at) {
    const message = `${paramCount} argument(s) required but ${argCount} passed`
    must(argCount === paramCount, message, at)
  }

  // Building the program representation will be done together with semantic
  // analysis and error checking. In Ohm, we do this with a semantics object
  // that has an operation for each relevant rule in the grammar. Since the
  // purpose of analysis is to build the program representation, we will name
  // the operations "rep" for "representation". Most of the rules are straight-
  // forward except for those dealing with function and type declarations,
  // since types and functions need to be dealt with in two steps to allow
  // recursion.
  const builder = match.matcher.grammar.createSemantics().addOperation("rep", {
    Program(statements) {
      console.log("HERE")
      return core.program(statements.children.map((s) => s.rep()))
    },

    FuncDecl_function_public(_ocean, type, tag, _parenL, params, _parenR, block) {
      const functionType = core.functionType(params.rep().map((p) => p.type), type.rep())
      const functionEntity = core.fun(tag.sourceString, functionType)
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      context.add(tag.sourceString, functionEntity)
      context = context.newChildContext({ function: functionEntity })
      const body = block.rep()
      context = context.parent
      return core.functionDeclaration(tag.sourceString, functionEntity, params.rep(), body)
    },

    FuncDecl_function_private(_ocean, type, tag, _parenL, params, _parenR, block) {
      const functionType = core.functionType(params.rep().map((p) => p.type), type.rep())
      const functionEntity = core.fun(tag.sourceString, functionType)
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      context.add(tag.sourceString, functionEntity)
      context = context.newChildContext({ function: functionEntity })
      const body = block.rep()
      context = context.parent
      return core.functionDeclaration(tag.sourceString, functionEntity, params.rep(), body)
    },

    FuncDecl_function_public_no_params(_ocean, type, tag, _parenL,  _parenR, block) {
      const functionType = core.functionType([], type.rep())
      const functionEntity = core.fun(tag.sourceString, functionType)
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      context.add(tag.sourceString, functionEntity)
      context = context.newChildContext({ function: functionEntity })
      const body = block.rep()
      context = context.parent
      return core.functionDeclaration(tag.sourceString, functionEntity, [], body)
    },

    FuncDecl_function_private_no_params(_lake, type, tag, _parenL, _parenR, block) {
      const functionType = core.functionType([], type.rep())
      const functionEntity = core.fun(tag.sourceString, functionType)
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      context.add(tag.sourceString, functionEntity)
      context = context.newChildContext({ function: functionEntity })
      const body = block.rep()
      context = context.parent
      return core.functionDeclaration(tag.sourceString, functionEntity, [], body)
    },

    VarDecl_variable_public(_ocean, type, tag, _eq, exp) {
      const variable = core.variable(tag.sourceString, false, type.rep())
      mustNotAlreadyBeDeclared(variable.name, { at: tag })
      context.add(variable.name, variable)
      if (exp.sourceString !== "") {
        const expression = exp.rep()
        mustBeAssignable(expression, { toType: variable.type }, { at: exp })
        return core.variableDeclaration(variable, expression)
      }
      return core.variableDeclaration(variable, null)
    },
    VarDecl_variable_private(_lake, type, tag, _eq, exp) {
      const variable = core.variable(tag.sourceString, true, type.rep())
      mustNotAlreadyBeDeclared(variable.name, { at: tag })
      context.add(variable.name, variable)
      if (exp.sourceString !== "") {
        const expression = exp.rep()
        mustBeAssignable(expression, { toType: variable.type }, { at: exp })
        return core.variableDeclaration(variable, expression)
      }
      return core.variableDeclaration(variable, null)
    },
    VarDecl_type_public(_ocean, type, tag) {
      const variable = core.variable(tag.sourceString, false, type.rep())
      mustNotAlreadyBeDeclared(variable.name, { at: tag })
      context.add(variable.name, variable)
      return core.variableDeclaration(variable, null)
    },
    VarDecl_type_private(_lake, type, tag) {
      const variable = core.variable(tag.sourceString, true, type.rep())
      mustNotAlreadyBeDeclared(variable.name, { at: tag })
      context.add(variable.name, variable)
      return core.variableDeclaration(variable, null)
    },

    TypeDecl(_boat, tag, braceL, VarDecl, braceR) {
      const structType = core.structType(tag.sourceString, VarDecl.rep())
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      mustNotBeSelfContaining(structType, { at: tag })
      context.add(tag.sourceString, structType)
      return core.typeDeclaration(structType)
    },

    ClassDecl_class_public(_ocean, school, tag, _colon) {
      const classType = core.structType(tag.sourceString, [])
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      context.add(tag.sourceString, classType)
      return classType
    },

    ClassDecl_class_private(_lake, school, tag, _colon) {
      const classType = core.structType(tag.sourceString, [])
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      context.add(tag.sourceString, classType)
      return classType
    },


    Type_array(_left, baseType, _right) {
      return core.arrayType(baseType.rep())
    },

    Array_exp(_open, args, _close) {
      const elements = args.asIteration().children.map((e) => e.rep())
      mustAllHaveSameType(elements, { at: args })
      return core.arrayExpression(elements)
    },

    Empty_array(ty, _open, _close) {
      const type = ty.rep()
      mustBeAnArrayType(type, { at: ty })
      return core.emptyArray(type)
    },

    Type_struct(boat, tag ,bracketL, varDecl, bracketR) {
      const structType = core.structType(tag.sourceString, varDecl.rep())
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      mustNotBeSelfContaining(structType, { at: tag })
      context.add(tag.sourceString, structType)
      return structType
    },

    Statement_assign(variable, _eq, expression, _semicolon) {
      const source = expression.rep()
      const target = variable.rep()
      mustBeAssignable(source, { toType: target.type }, { at: variable })
      mustNotBeReadOnly(target, { at: variable })
      return core.assignment(target, source)
    },

    PrintStmt(_cast, _colon, exp) {
      const expression = exp.rep()
      return core.printStatement(expression)
    },

    IfStmt_if_else(_if, exp, block1, _else, block2) {
      const test = exp.rep()
      mustHaveBooleanType(test, { at: exp })
      context = context.newChildContext()
      const consequent = block1.rep()
      context = context.parent
      context = context.newChildContext()
      const alternate = block2.rep()
      context = context.parent
      return core.ifStatement(test, consequent, alternate)
    },

    IfStmt_nested_if(_if, exp, block, _else, trailingIfStatement) {
      const test = exp.rep()
      mustHaveBooleanType(test, { at: exp })
      context = context.newChildContext()
      const consequent = block.rep()
      // Do NOT make a new context for the alternate!
      const alternate = trailingIfStatement.rep()
      return core.ifStatement(test, consequent, alternate)
    },

    IfStmt_if(_if, exp, block) {
      const test = exp.rep()
      mustHaveBooleanType(test, { at: exp })
      context = context.newChildContext()
      const consequent = block.rep()
      context = context.parent
      return core.shortIfStatement(test, consequent)
    },

    ForStmt_for_in_range(_stream, tag, _in, exp, parenL, exp1, exp2, parenR, exp, block){
      const [low, high] = [exp1.rep(), exp2.rep()]
      mustHaveIntegerType(low, { at: exp1 })
      mustHaveIntegerType(high, { at: exp2 })
      const iterator = core.variable(tag.sourceString, INT, true)
      context = context.newChildContext({ inLoop: true })
      context.add(tag.sourceString, iterator)
      const body = block.rep()
      context = context.parent
      return core.forRangeStatement(iterator, low, high, body)
    },

    ForStmt_for_in_collection(_stream, tag, _in, exp, block){
      const collection = exp.rep()
      mustHaveAnArrayType(collection, { at: exp })
      const iterator = core.variable(tag.sourceString, true, collection.type.baseType)
      context = context.newChildContext({ inLoop: true })
      context.add(iterator.name, iterator)
      const body = block.rep()
      context = context.parent
      return core.forStatement(iterator, collection, body)
    },

    WhileStmt_while(_tide, exp, block) {
      const test = exp.rep()
      mustHaveBooleanType(test, { at: exp })
      context = context.newChildContext({ inLoop: true })
      const body = block.rep()
      context = context.parent
      return core.whileStatement(test, body)
    },

    ReturnStmt_return(_reel, exp) {
      const expression = exp.rep()
      const f = context.function
      mustBeInAFunction({ at: _reel })
      mustBeReturnable(expression, { from: f }, { at: _reel })
      return core.returnStatement(expression)
    },

    BreakStmt_break(_snap){
      mustBeInLoop({ at: _snap })
      return core.breakStatement()
    },

    ContinueStmt_continue(_flow){
      mustBeInLoop({ at: _flow })
      return core.breakStatement()
    },

    TryStmt(_pitch, block, _catch){
      const body = block.rep()
      return core.tryStatement(body)
    },

    Catch(_catch, parenL, tag, parenR, block){
      const body = block.rep()
      return core.catchStatement(tag.sourceString, body)
    },

    Field(id, _colon, type) {
      return core.field(id.sourceString, type.rep())
    },

    Type_id(id) {
      const entity = context.lookup(id.sourceString)
      mustHaveBeenFound(entity, id.sourceString, { at: id })
      mustBeAType(entity, { at: id })
      return entity
    },


    FuncCall(tag, parenL, expList, parenR) {
      const callee = tag.rep()
      mustBeCallable(callee, { at: tag })
      const exps = expList.asIteration().children
      const targetTypes =
        callee?.kind === "StructType"
          ? callee.fields.map(f => f.type)
          : callee.type.paramTypes
      mustHaveCorrectArgumentCount(exps.length, targetTypes.length, { at: parenL })
      const args = exps.map((exp, i) => {
        const arg = exp.rep()
        mustBeAssignable(arg, { toType: targetTypes[i] }, { at: exp })
        return arg
      })
      return callee?.kind === "StructType"
        ? core.constructorCall(callee, args)
        : core.functionCall(callee, args)
    },

    Block(_open, statements, _close) {
      // No need for a block node, just return the list of statements
      return statements.children.map((s) => s.rep())
    },

    Unwrap_else(exp1, elseOp, exp2) {
      const [optional, op, alternate] = [exp1.rep(), elseOp.sourceString, exp2.rep()]
      mustHaveAnOptionalType(optional, { at: exp1 })
      mustBeAssignable(alternate, { toType: optional.type.baseType }, { at: exp2 })
      return core.binary(op, optional, alternate, optional.type)
    },

    Compare(leftOp, relop, rightOp) {
      const [left, op, right] = [leftOp.rep(), relop.sourceString, rightOp.rep()]
      // == and != can have any operand types as long as they are the same
      // But inequality operators can only be applied to numbers and strings
      if (["<", "<=", ">", ">="].includes(op)) {
        mustHaveNumericOrStringType(left, { at: leftOp })
      }
      mustBothHaveTheSameType(left, right, { at: relop })
      return core.binary(op, left, right, BOOLEAN)
    },

    Add(leftOp, addOp, rightOp) {
      const [left, op, right] = [leftOp.rep(), addOp.sourceString, rightOp.rep()]
      if (op === "+") {
        mustHaveNumericOrStringType(left, { at: leftOp })
      } else {
        mustHaveNumericType(left, { at: leftOp })
      }
      mustBothHaveTheSameType(left, right, { at: addOp })
      return core.binary(op, left, right, left.type)
    },

    Exp7_multiply(leftOp, mulOp, rightOp) {
      const [left, op, right] = [leftOp.rep(), mulOp.sourceString, rightOp.rep()]
      mustHaveNumericType(left, { at: leftOp })
      mustBothHaveTheSameType(left, right, { at: mulOp })
      return core.binary(op, left, right, left.type)
    },

    //NEEDS WORK
    Unary(unaryOp, exp) {
      const [op, operand] = [unaryOp.sourceString, exp.rep()]
      let type
      if (op === "#") {
        mustHaveAnArrayType(operand, { at: exp })
        type = INT
      } else if (op === "-") {
        mustHaveNumericType(operand, { at: exp })
        type = operand.type
      } else if (op === "!") {
        mustHaveBooleanType(operand, { at: exp })
        type = BOOLEAN
      } else if (op === "some") {
        type = core.optionalType(operand.type)
      } else if (op === "random") {
        mustHaveAnArrayType(operand, { at: exp })
        type = operand.type.baseType
      }
      return core.unary(op, operand, type)
    },

    Parens(_open, expression, _close) {
      return expression.rep()
    },

    Id(tag) {
      // When an id appears in an expression, it had better have been declared
      const entity = context.lookup(tag.sourceString)
      mustHaveBeenFound(entity, tag.sourceString, { at: tag })
      return entity
    },

    true(_hooked) {
      return _hooked
    },

    false(_unhooked) {
      return _unhooked
    },

    intlit(_digits) {
      return BigInt(this.sourceString)
    },

    floatlit(_whole, _point, _fraction, _e, _sign, _exponent) {
      return Number(this.sourceString)
    },

    stringlit(_openQuote, _chars, _closeQuote) {
      return this.sourceString
    },
  })
  return builder(match).rep()
}

//STILL NEEDS: CLASSES, CONTINUE STATEMENT, TRY CATCH, PRINTSTMT, TYPES?, and GENERAL BUG CLEANING/FIXES
