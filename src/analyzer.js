// The semantic analyzer exports a single function, analyze(match), that
// accepts a grammar match object (the CST) from Ohm and produces the
// internal representation of the program (pretty close to what is usually
// called the AST). This representation also includes entities from the
// standard library, as needed.

import * as core from "./core.js"

const INT = core.intType
const NUMBER = core.numberType
const BOOLEAN = core.boolType
const STRING = core.stringType
const VOID = core.voidType
const ANY = core.anyType

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
    must(e.type == NUMBER, "Expected a number", at)
  }

  function mustHaveNumericOrStringType(e, at) {
    must([NUMBER, STRING].includes(e.type), "Expected a number or string", at)
  }

  function mustHaveBooleanType(e, at) {
    must(e.type === BOOLEAN, "Expected a boolean", at)
  }

  function cannotAssignANumberToVoid(e, at) {
    must(e.type !== VOID, "Cannot assign a number to void", at)
  }

  function mustHaveAnArrayType(e, at) {
    must(e.type?.kind === "ArrayType", "Expected an array", at)
  }

  // function mustHaveAStructType(e, at) {
  //   must(e.type?.kind === "StructType", "Expected a struct", at)
  // }

  function mustBothHaveTheSameType(e1, e2, at) {
    must(equivalent(e1.type, e2.type), "Operands do not have the same type", at)
  }

  // function mustAllHaveSameType(expressions, at) {
  //   // Used to check the elements of an array expression, and the two
  //   // arms of a conditional expression, among other scenarios.
  //   must(
  //     expressions.slice(1).every((e) => equivalent(e.type, expressions[0].type)),
  //     "Not all elements have the same type",
  //     at
  //   )
  // }

  function mustBeAType(e, at) {
    // This is a rather ugly hack
    must(e?.kind.endsWith("Type"), "Type expected", at)
  }

  function mustNotContainBreakInFunction(at) {
    must(!context.inLoop, "Break can only appear in a loop", at)
  }

  function includesAsField(structType, type) {
    // Whether the struct type has a field of type type, directly or indirectly
    return structType.fields.some(
      (field) =>
        field.type === type)
         // || (field.type?.kind === "StructType" && includesAsField(field.type, type))
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
        equivalent(t1.baseType, t2.baseType)) 
      //   ||
      // (t1?.kind === "FunctionType" &&
      //   t2?.kind === "FunctionType" &&
      //   equivalent(t1.returnType, t2.returnType) &&
      //   t1.paramTypes.length === t2.paramTypes.length &&
      //   t1.paramTypes.every((t, i) => equivalent(t, t2.paramTypes[i])))
    )
  }

  function assignable(fromType, toType) {
    return (
      toType == ANY ||
      equivalent(fromType, toType) 
      // ||
      // (fromType?.kind === "FunctionType" &&
      //   toType?.kind === "FunctionType" &&
      //   assignable(fromType.returnType, toType.returnType) &&
      //   fromType.paramTypes.length === toType.paramTypes.length &&
      //   toType.paramTypes.every((t, i) => assignable(t, fromType.paramTypes[i])))
    )
  }

  function typeDescription(type) {
    switch (type.kind) {
      case "NumberType":
        return "number"
      case "StringType":
        return "string"
      case "BoolType":
        return "boolean"
      // case "VoidType":   //CHECK
      //   return "void"
      // case "StructType":
      //   return type.name
      // case "FunctionType": {
      //   const paramTypes = type.paramTypes.map(typeDescription).join(", ")
      //   const returnType = typeDescription(type.returnType)
      //   return `(${paramTypes})->${returnType}`
      // }
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

  // function mustNotBeReadOnly(e, at) {
  //   must(!e.readOnly, `Cannot assign to constant ${e.name}`, at)
  // }

  function mustHaveDistinctFields(type, at) {
    const fieldNames = new Set(type.fields.map((f) => f.name))
    must(fieldNames.size === type.fields.length, "Fields must be distinct", at)
  }

  // function mustHaveMember(structType, field, at) {
  //   must(structType.fields.map((f) => f.name).includes(field), "No such field", at)
  // }

  function mustBeInLoop(at) {
    must(context.inLoop, "Break can only appear in a loop", at)
  }

  function continuMustBeInLoop(at) {
    must(context.inLoop, "Continue can only appear in a loop", at)
  }

  function mustBeInAFunction(at) {
    must(context.function, "Return can only appear in a function", at)
  }

  function mustBeCallable(e, at) {
    const callable = e?.kind === "Function"
    must(callable, "Call of non-function", at)
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

  // function mustNotBeInPrivateClass(at) {
  //   let currentContext = context
  //   while (currentContext !== null) {
  //     if (currentContext.function && currentContext.function.isPrivate) {
  //       throw new Error("Public classes can't be made in Private classes")
  //     }
  //     currentContext = currentContext.parent
  //   }
  // }

  function mustNotBeInFunction(at) {
    must(!context.function, "Classes can't be made inside of functions", at)
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
      return core.program(statements.children.map((s) => s.rep()))
    },

    FuncDecl_function_public(_ocean, type, tag, _parenL, params, _parenR, block) {
      const functionType = core.functionType(
        undefined, //changed
        type.rep()
      )
      const functionEntity = core.fun(tag.sourceString, functionType)
      cannotAssignANumberToVoid(functionType, { at: tag })
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      context.add(tag.sourceString, functionEntity)
      context = context.newChildContext({ function: functionEntity })
      let analyzedParams = params.rep()
      functionType.paramTypes = analyzedParams.map((p) => p.type) //changed
      const body = block.rep()
      context = context.parent
      mustNotContainBreakInFunction({ at: tag })
      return core.functionDeclaration(
        tag.sourceString,
        functionEntity,
        analyzedParams,
        body
      )
    },

    FuncDecl_function_private(_ocean, type, tag, _parenL, params, _parenR, block) {
      const functionType = core.functionType(undefined, type.rep())
      const functionEntity = core.fun(tag.sourceString, functionType)
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      cannotAssignANumberToVoid(functionType, { at: tag })
      context.add(tag.sourceString, functionEntity)
      context = context.newChildContext({ function: functionEntity })
      let analyzedParams = params.rep()
      functionType.paramTypes = analyzedParams.map((p) => p.type)
      const body = block.rep()
      context = context.parent
      mustNotContainBreakInFunction({ at: tag })
      return core.functionDeclaration(
        tag.sourceString,
        functionEntity,
        analyzedParams,
        params.rep(),
        body
      )
    },

    // FuncDecl_function_public_no_params(_ocean, type, tag, _parenL, _parenR, block) {
    //   const functionType = core.functionType([], undefined, type.rep())
    //   const functionEntity = core.fun(tag.sourceString, functionType)
    //   cannotAssignANumberToVoid(functionType, { at: tag })
    //   mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
    //   context.add(tag.sourceString, functionEntity)
    //   context = context.newChildContext({ function: functionEntity })
    //   let analyzedParams = params.rep()
    //   functionType.paramTypes = analyzedParams.map((p) => p.type)
    //   const body = block.rep()
    //   context = context.parent
    //   mustNotContainBreakInFunction({ at: tag })
    //   return core.functionDeclaration(
    //     tag.sourceString,
    //     functionEntity,
    //     [],
    //     analyzedParams,
    //     body
    //   )
    // },

    // FuncDecl_function_private_no_params(_lake, type, tag, _parenL, _parenR, block) {
    //   const functionType = core.functionType([], undefined, type.rep())
    //   const functionEntity = core.fun(tag.sourceString, functionType)
    //   cannotAssignANumberToVoid(functionType, { at: tag })
    //   mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
    //   context.add(tag.sourceString, functionEntity)
    //   context = context.newChildContext({ function: functionEntity })
    //   let analyzedParams = params.rep()
    //   functionType.paramTypes = analyzedParams.map((p) => p.type)
    //   const body = block.rep()
    //   context = context.parent
    //   mustNotContainBreakInFunction({ at: tag })
    //   return core.functionDeclaration(
    //     tag.sourceString,
    //     functionEntity,
    //     [],
    //     analyzedParams,
    //     body
    //   )
    // },

    VarDecl_variable_public(_ocean, type, tag, _eq, exp) {
      const variable = core.variable(tag.sourceString, false, type.rep())
      mustNotAlreadyBeDeclared(variable.name, { at: tag })
      context.add(variable.name, variable)
      const expression = exp.rep()
      mustBeAssignable(expression, { toType: variable.type }, { at: exp })
      return core.variableDeclaration(variable, expression)
    },
    VarDecl_variable_private(_lake, type, tag, _eq, exp) {
      const variable = core.variable(tag.sourceString, true, type.rep())
      mustNotAlreadyBeDeclared(variable.name, { at: tag })
      context.add(variable.name, variable)
      const expression = exp.rep()
      mustBeAssignable(expression, { toType: variable.type }, { at: exp })
      return core.variableDeclaration(variable, expression)
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

    StructDecl(_boat, tag, _braceL, fields, _braceR) {
      const fieldReps = fields.children.map((f) => f.rep())
      const structType = core.structType(tag.sourceString, fieldReps)
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      mustNotBeSelfContaining(structType, { at: tag })
      context.add(tag.sourceString, structType)
      mustHaveDistinctFields(structType, { at: _braceL })
      return core.typeDeclaration(structType)
    },

    ClassDecl_class_public(_ocean, school, tag, _colon) {
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      // mustNotBeInPrivateClass({ at: tag })
      mustNotBeInFunction({ at: tag })
      const classType = core.structType(tag.sourceString, [])
      context.add(tag.sourceString, classType)
      return classType
    },

    ClassDecl_class_private(_lake, school, tag, _colon) {
      mustNotAlreadyBeDeclared(tag.sourceString, { at: tag })
      mustNotBeInFunction({ at: tag })
      const classType = core.structType(tag.sourceString, [])
      context.add(tag.sourceString, classType)
      return classType
    },

    Field(type, tag) {
      return core.field(tag.sourceString, type.rep())
    },

    Type_array(baseType, _brackets) {
      return core.arrayType(baseType.rep())
    },

    Type_void(_lost) {
      return core.voidType
    },

    Exp_or(left, _or, right) {
      const [leftOperand, rightOperand] = [left.rep(), right.rep()]
      mustHaveBooleanType(leftOperand, { at: left })
      mustHaveBooleanType(rightOperand, { at: right })
      return core.binary("||", leftOperand, rightOperand, BOOLEAN)
    },

    Exp1_and(left, _and, right) {
      const [leftOperand, rightOperand] = [left.rep(), right.rep()]
      mustHaveBooleanType(leftOperand, { at: left })
      mustHaveBooleanType(rightOperand, { at: right })
      return core.binary("&&", leftOperand, rightOperand, BOOLEAN)
    },

    Exp2_relational_operator(left, relop, right) {
      // ==, !=. <, <=, >, >=
      const [leftOperand, op, rightOperand] = [
        left.rep(),
        relop.sourceString,
        right.rep(),
      ]
      if (["<", "<=", ">", ">="].includes(op)) {
        mustHaveNumericOrStringType(leftOperand, { at: left })
      }
      mustBothHaveTheSameType(leftOperand, rightOperand, { at: relop })
      return core.binary(op, leftOperand, rightOperand, BOOLEAN)
    },

    Exp3_add_subtract(left, addOp, right) {
      const [leftOperand, op, rightOperand] = [
        left.rep(),
        addOp.sourceString,
        right.rep(),
      ]
      if (op === "+") {
        mustHaveNumericOrStringType(leftOperand, { at: left })
      } else {
        mustHaveNumericType(leftOperand, { at: left })
      }
      mustBothHaveTheSameType(leftOperand, rightOperand, { at: addOp })
      return core.binary(op, leftOperand, rightOperand, leftOperand.type)
    },

    Term_multi_divide_modulo(left, mulOp, right) {
      const [leftOperand, op, rightOperand] = [
        left.rep(),
        mulOp.sourceString,
        right.rep(),
      ]
      mustHaveNumericType(leftOperand, { at: left })
      mustBothHaveTheSameType(leftOperand, rightOperand, { at: mulOp })
      return core.binary(op, leftOperand, rightOperand, leftOperand.type)
    },

    Factor_exponent(primary, _exp, exponent) {
      const [base, exp] = [primary.rep(), exponent.rep()]
      mustHaveNumericType(base, { at: primary })
      mustHaveNumericType(exp, { at: exponent })
      return core.binary("**", base, exp, base.type)
    },

    Block(_bracketL, statements, _bracketR) {
      return statements.children.map((s) => s.rep())
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
      return core.nestedIfStatement(test, consequent, alternate)
    },

    IfStmt_if(_if, exp, block) {
      const test = exp.rep()
      mustHaveBooleanType(test, { at: exp })
      context = context.newChildContext()
      const consequent = block.rep()
      context = context.parent
      return core.shortIfStatement(test, consequent)
    },

    ForStmt_for_in_range(_stream, tag, _in, low, op, high, block) {
      const iterator = core.variable(tag.sourceString, true, INT)
      context = context.newChildContext({ inLoop: true })
      context.add(iterator.name, iterator)
      const body = block.rep()
      context = context.parent
      return core.forRangeStatement(
        iterator,
        low.rep(),
        op.sourceString,
        high.rep(),
        body
      )
    },

    ForStmt_for_in_collection(_stream, tag, _in, exp, block) {
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

    ReturnStmt_long(_reel, exp) {
      const expression = exp.rep()
      const f = context.function
      mustBeInAFunction({ at: _reel })
      mustReturnSomething(f, { at: _reel })
      mustBeReturnable(expression, { from: f }, { at: _reel })
      return core.returnStatement(expression)
    },

    ReturnStmt_short(_reel) {
      const f = context.function
      mustBeInAFunction({ at: _reel })
      mustNotReturnAnything(f, { at: _reel })
      return core.shortReturnStatement()
    },

    IncStmt(tag, op) {
      const variable = tag.rep()
      mustHaveNumericType(variable, { at: tag })
      return core.incrementStatement(variable, op.sourceString)
    },

    DecStmt(tag, op) {
      const variable = tag.rep()
      mustHaveNumericType(variable, { at: tag })
      return core.decrementStatement(variable, op.sourceString)
    },

    BreakStmt_break(_snap) {
      mustBeInLoop({ at: _snap })
      return core.breakStatement
    },

    ContinueStmt_continue(_flow) {
      continuMustBeInLoop({ at: _flow })
      return core.breakStatement()
    },

    TryStmt(_pitch, block, _catch) {
      const body = block.rep()
      return core.tryCatchStatement(body)
    },

    // Catch(_catch, _parenL, tag, _parenR, block) {
    //   const body = block.rep()
    //   return core.catchStatement(tag.sourceString, body)
    // },

    Type_id(id) {
      const entity = context.lookup(id.sourceString)
      mustHaveBeenFound(entity, id.sourceString, { at: id })
      mustBeAType(entity, { at: id })
      return entity
    },

    FuncCall(tag, parenL, expList, _parenR) {
      const callee = tag.rep()
      mustBeCallable(callee, { at: tag })
      const exps = expList.asIteration().children
      const targetTypes = callee.type.paramTypes
        // callee?.kind === "StructType"
        //   // ? callee.fields.map((f) => f.type)
        //   callee.type.paramTypes
      mustHaveCorrectArgumentCount(exps.length, targetTypes.length, { at: parenL })
      const args = exps.map((exp, i) => {
        const arg = exp.rep()
        mustBeAssignable(arg, { toType: targetTypes[i] }, { at: exp })
        return arg
      })
        return core.functionCall(callee, args)
      // return callee?.kind === "StructType"
      //   ? core.constructorCall(callee, args)
      //   : core.functionCall(callee, args)
    },

    Primary_parens(_open, expression, _close) {
      return expression.rep()
    },

    Primary_array(_open, expList, _close) {
      let elements = expList.asIteration().children.map((e) => e.rep())
      let array = core.arrayExpression(elements)
      array.type = core.arrayType(elements[0].type)
      return array
    },

    Primary_unary(unaryOp, exp) {
      const [op, operand] = [unaryOp.sourceString, exp.rep()]
      if (op === "-") {
        mustHaveNumericType(operand, { at: exp })
        return core.unary(op, operand, NUMBER)
      } else {
        mustHaveBooleanType(operand, { at: exp })
        return core.unary(op, operand, BOOLEAN)
      }
    },

    Params(expList) {
      return expList.asIteration().children.map((e) => e.rep())
    },

    Param(type, tag) {
      const paramName = tag.sourceString
      mustNotAlreadyBeDeclared(paramName, { at: tag })
      const variable = core.variable(paramName, false, type.rep())
      context.add(paramName, variable)
      return variable
    },

    Primary_id(tag) {
      const entity = context.lookup(tag.sourceString)
      mustHaveBeenFound(entity, tag.sourceString, { at: tag })
      return entity
    },

    hooked(_hooked) {
      return true
    },

    unhooked(_unhooked) {
      return false
    },

    number(_) {
      return core.numberType
    },
    string(_) {
      return core.stringType
    },
    // land(_) {
    //   return "land"
    // },
    boolean(_) {
      return core.boolType
    },

    fish(_whole, _point, _fraction, _e, _sign, _exponent) {
      return Number(this.sourceString)
    },

    stringlit(_openQuote, _chars, _closeQuote) {
      return this.sourceString
    },
  })
  return builder(match).rep()
}
