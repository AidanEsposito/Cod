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
        return core.program(statements.children.map((s) => s.rep()))
      },

      FunDecl(_fun, id, parameters, _colons, type, block) {
        // Start by making the function, but we don't yet know its type.
        // Also add it to the context so that we can have recursion.
        const fun = core.fun(id.sourceString)
        mustNotAlreadyBeDeclared(id.sourceString, { at: id })
        context.add(id.sourceString, fun)

        // Parameters are part of the child context
        context = context.newChildContext({ inLoop: false, function: fun })
        const params = parameters.rep()

        // Now that the parameters are known, we compute the function's type.
        // This is fine; we did not need the type to analyze the parameters,
        // but we do need to set it before analyzing the body.
        const paramTypes = params.map((param) => param.type)
        const returnType = type.children?.[0]?.rep() ?? VOID
        fun.type = core.functionType(paramTypes, returnType)

        // Analyze body while still in child context
        const body = block.rep()

        // Go back up to the outer context before returning
        context = context.parent
        return core.functionDeclaration(fun, params, body)
      },

      Type_function(_left, types, _right, _arrow, type) {
        const paramTypes = types.asIteration().children.map((t) => t.rep())
        const returnType = type.rep()
        return core.functionType(paramTypes, returnType)
      },

      Params(_open, paramList, _close) {
        // Returns a list of variable nodes
        return paramList.asIteration().children.map((p) => p.rep())
      },

      Param(id, _colon, type) {
        const param = core.variable(id.sourceString, false, type.rep())
        mustNotAlreadyBeDeclared(param.name, { at: id })
        context.add(param.name, param)
        return param
      },

      TypeDecl(_struct, id, _left, fields, _right) {
        // To allow recursion, enter into context without any fields yet
        const type = core.structType(id.sourceString, [])
        mustNotAlreadyBeDeclared(id.sourceString, { at: id })
        context.add(id.sourceString, type)
        // Now add the types as you parse and analyze. Since we already added
        // the struct type itself into the context, we can use it in fields.
        type.fields = fields.children.map((field) => field.rep())
        mustHaveDistinctFields(type, { at: id })
        mustNotBeSelfContaining(type, { at: id })
        return core.typeDeclaration(type)
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

      Field(id, _colon, type) {
        return core.field(id.sourceString, type.rep())
      },

      Type_id(id) {
        const entity = context.lookup(id.sourceString)
        mustHaveBeenFound(entity, id.sourceString, { at: id })
        mustBeAType(entity, { at: id })
        return entity
      },

      Statement_assign(variable, _eq, expression, _semicolon) {
        const source = expression.rep()
        const target = variable.rep()
        mustBeAssignable(source, { toType: target.type }, { at: variable })
        mustNotBeReadOnly(target, { at: variable })
        return core.assignment(target, source)
      },

      // Statement_call(call, _semicolon) { //function call
      //   return call.rep()
      // },

      //#NEED CLASS DECLARATION, TRY CATCH, AND OTHER VARIABLES IN CHART

      Statement_return(returnKeyword, exp, _semicolon) {
        mustBeInAFunction({ at: returnKeyword })
        mustReturnSomething(context.function, { at: returnKeyword })
        const returnExpression = exp.rep()
        mustBeReturnable(returnExpression, { from: context.function }, { at: exp })
        return core.returnStatement(returnExpression)
      },

      Statement_shortreturn(returnKeyword, _semicolon) {
        mustBeInAFunction({ at: returnKeyword })
        mustNotReturnAnything(context.function, { at: returnKeyword })
        return core.shortReturnStatement()
      },

      IfStmt_long(_if, exp, block1, _else, block2) {
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

      IfStmt_elsif(_if, exp, block, _else, trailingIfStatement) {
        const test = exp.rep()
        mustHaveBooleanType(test, { at: exp })
        context = context.newChildContext()
        const consequent = block.rep()
        // Do NOT make a new context for the alternate!
        const alternate = trailingIfStatement.rep()
        return core.ifStatement(test, consequent, alternate)
      },

      IfStmt_short(_if, exp, block) {
        const test = exp.rep()
        mustHaveBooleanType(test, { at: exp })
        context = context.newChildContext()
        const consequent = block.rep()
        context = context.parent
        return core.shortIfStatement(test, consequent)
      },

      LoopStmt_while(_while, exp, block) {
        const test = exp.rep()
        mustHaveBooleanType(test, { at: exp })
        context = context.newChildContext({ inLoop: true })
        const body = block.rep()
        context = context.parent
        return core.whileStatement(test, body)
      },

      LoopStmt_repeat(_repeat, exp, block) {
        const count = exp.rep()
        mustHaveIntegerType(count, { at: exp })
        context = context.newChildContext({ inLoop: true })
        const body = block.rep()
        context = context.parent
        return core.repeatStatement(count, body)
      },

      LoopStmt_range(_for, id, _in, exp1, op, exp2, block) {
        const [low, high] = [exp1.rep(), exp2.rep()]
        mustHaveIntegerType(low, { at: exp1 })
        mustHaveIntegerType(high, { at: exp2 })
        const iterator = core.variable(id.sourceString, INT, true)
        context = context.newChildContext({ inLoop: true })
        context.add(id.sourceString, iterator)
        const body = block.rep()
        context = context.parent
        return core.forRangeStatement(iterator, low, op.sourceString, high, body)
      },

      // LoopStmt_collection(_for, id, _in, exp, block) {
      //   const collection = exp.rep()
      //   mustHaveAnArrayType(collection, { at: exp })
      //   const iterator = core.variable(id.sourceString, true, collection.type.baseType)
      //   context = context.newChildContext({ inLoop: true })
      //   context.add(iterator.name, iterator)
      //   const body = block.rep()
      //   context = context.parent
      //   return core.forStatement(iterator, collection, body)
      // },

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

      // Exp9_member(exp, dot, id) {
      //   const object = exp.rep()
      //   let structType
      //   if (dot.sourceString === "?.") {
      //     mustHaveAnOptionalStructType(object, { at: exp })
      //     structType = object.type.baseType
      //   } else {
      //     mustHaveAStructType(object, { at: exp })
      //     structType = object.type
      //   }
      //   mustHaveMember(structType, id.sourceString, { at: id })
      //   const field = structType.fields.find(f => f.name === id.sourceString)
      //   return core.memberExpression(object, dot.sourceString, field)
      // },

      //  Exp9_call(exp, open, expList, _close) {
      //   const callee = exp.rep()
      //   mustBeCallable(callee, { at: exp })
      //   const exps = expList.asIteration().children
      //   const targetTypes =
      //     callee?.kind === "StructType"
      //       ? callee.fields.map(f => f.type)
      //       : callee.type.paramTypes
      //   mustHaveCorrectArgumentCount(exps.length, targetTypes.length, { at: open })
      //   const args = exps.map((exp, i) => {
      //     const arg = exp.rep()
      //     mustBeAssignable(arg, { toType: targetTypes[i] }, { at: exp })
      //     return arg
      //   })
      //   return callee?.kind === "StructType"
      //     ? core.constructorCall(callee, args)
      //     : core.functionCall(callee, args)
      // },
      Id(id) {
        // When an id appears in an expression, it had better have been declared
        const entity = context.lookup(id.sourceString)
        mustHaveBeenFound(entity, id.sourceString, { at: id })
        return entity
      },

      true(_) {
        return true
      },

      false(_) {
        return false
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
} //FIX SEMICOLON LINEUP

//STILL NEEDS: CLASSES, CONTINUE STATEMENT, TRY CATCH, PRINTSTMT, TYPES?, and GENERAL BUG CLEANING/FIXES
