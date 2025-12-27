// Test file specifically for call_macro annotations with AstCallMacro inheritance

[call_macro(name="yeild_from")]
class private YieldFrom : AstCallMacro
    //! This macro converts yield_from(THAT) expression into::
    //!
    //!     for t in THAT
    //!         yield t
    //!
    //! The idea is that coroutine or generator can continuesly yield from another sub-coroutine or generator.
    def override visit ( prog:ProgramPtr; mod:Module?; var call:smart_ptr<ExprCallMacro> ) : ExpressionPtr
        macro_verify( call.arguments |> length==1,prog,call.at,"expecting yeild_from(iterator)" )
        macro_verify( call.arguments[0]._type!=null,prog,call.at,"expecting iterator" )
        macro_verify( call.arguments[0]._type.isIterator,prog,call.at,"expecting iterator" )
        let iname = make_unique_private_name("_yield_from_iterator",call.at)
        return <- qmacro_block <|
            for $i(iname) in $e(call.arguments[0])
                yield $i(iname)

[call_macro(name="co_continue")]
class private CoContinue : AstCallMacro
    //! This macro converts co_continue to yield true.
    //! The idea is that coroutine without specified type is underneath a coroutine which yields bool.
    //! That way co_continue() does not distract from the fact that it is a generator<bool>.
    def override visit ( prog:ProgramPtr; mod:Module?; var call:smart_ptr<ExprCallMacro> ) : ExpressionPtr
        // TODO: verify if we are in coroutine
        // TODO: verify if we are in coroutine which returns bool
        macro_verify( call.arguments |> length==0,prog,call.at,"expecting co_continue()" )
        return <- qmacro_expr <|
            yield true
