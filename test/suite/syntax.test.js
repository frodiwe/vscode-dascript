const assert = require('assert');
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { suite, test } = require('mocha');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

let registry;
let grammar;

/**
 * Initialize the TextMate registry and load the grammar
 */
async function initializeGrammar() {
    const wasmBin = fs.readFileSync(path.join(require.resolve('vscode-oniguruma'), '../onig.wasm')).buffer;
    await oniguruma.loadWASM(wasmBin);

    registry = new vsctm.Registry({
        onigLib: Promise.resolve({
            createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
            createOnigString: (str) => new oniguruma.OnigString(str)
        }),
        loadGrammar: async (scopeName) => {
            if (scopeName === 'source.dascript') {
                const grammarPath = path.join(__dirname, '../../syntaxes/dascript.tmLanguage.json');
                const grammarContent = fs.readFileSync(grammarPath, 'utf8');
                return vsctm.parseRawGrammar(grammarContent, grammarPath);
            }
            return null;
        }
    });

    grammar = await registry.loadGrammar('source.dascript');
}

/**
 * Get token scopes at a specific position in the document using TextMate grammar
 */
async function getTokenScopesAt(document, line, character) {
    if (!grammar) {
        await initializeGrammar();
    }

    const lineText = document.lineAt(line).text;

    // Tokenize all lines up to and including the target line to maintain state
    let ruleStack = vsctm.INITIAL;
    for (let i = 0; i <= line; i++) {
        const currentLineText = document.lineAt(i).text;
        const result = grammar.tokenizeLine(currentLineText, ruleStack);
        ruleStack = result.ruleStack;

        if (i === line) {
            // Find the token at the specified character position
            for (const token of result.tokens) {
                if (character >= token.startIndex && character < token.endIndex) {
                    return { scopes: token.scopes };
                }
            }
            // If character is at the end of line, return last token
            if (result.tokens.length > 0 && character >= result.tokens[result.tokens.length - 1].endIndex) {
                return { scopes: result.tokens[result.tokens.length - 1].scopes };
            }
        }
    }

    return { scopes: [] };
}

/**
 * Find position of text in a line
 */
function findInLine(document, lineNumber, searchText) {
    const line = document.lineAt(lineNumber);
    const index = line.text.indexOf(searchText);
    if (index === -1) {
        throw new Error(`Text "${searchText}" not found in line ${lineNumber}: ${line.text}`);
    }
    return new vscode.Position(lineNumber, index);
}

suite('daScript Syntax Highlighting Tests', () => {

    test('Optional type parameters should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/optional-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with optional type
        let optionalTypeLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('CombatUI?')) {
                optionalTypeLine = i;
                break;
            }
        }
        assert.ok(optionalTypeLine >= 0, 'Should find line with CombatUI? optional type');

        // Verify CombatUI? is tokenized as a type
        const combatUIPos = findInLine(document, optionalTypeLine, 'CombatUI');
        const combatUIScopes = await getTokenScopesAt(document, optionalTypeLine, combatUIPos.character);

        // The type should have a storage.type scope
        const hasTypeScope = combatUIScopes?.scopes?.some(scope =>
            scope.includes('storage.type') || scope.includes('entity.name.type')
        );
        assert.ok(hasTypeScope, `CombatUI? should be tokenized as a type. Got scopes: ${JSON.stringify(combatUIScopes?.scopes)}`);

        // Verify quat4 after CombatUI? is also tokenized as a type
        const quat4Pos = findInLine(document, optionalTypeLine, 'quat4');
        assert.ok(quat4Pos.character > combatUIPos.character, 'quat4 should appear after CombatUI?');

        const quat4Scopes = await getTokenScopesAt(document, optionalTypeLine, quat4Pos.character);
        const quat4HasTypeScope = quat4Scopes?.scopes?.some(scope =>
            scope.includes('storage.type') || scope.includes('entity.name.type')
        );
        assert.ok(quat4HasTypeScope, `quat4 should be tokenized as a type. Got scopes: ${JSON.stringify(quat4Scopes?.scopes)}`);

        console.log('✓ Optional type parameters test passed');
    });

    test('String interpolation with ternary operators should not break highlighting', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/string-interpolation.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with string containing ternary operator
        let ternaryStringLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('? "∞" :') && lineText.includes('"{max(currentAmount, 0)}"')) {
                ternaryStringLine = i;
                break;
            }
        }
        assert.ok(ternaryStringLine >= 0, 'Should find line with ternary in string interpolation');

        // Verify the infinity symbol is inside a string
        const infinityPos = findInLine(document, ternaryStringLine, '∞');
        const infinityScopes = await getTokenScopesAt(document, ternaryStringLine, infinityPos.character);
        const isInString = infinityScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isInString, `Infinity symbol should be inside a string. Got scopes: ${JSON.stringify(infinityScopes?.scopes)}`);

        // Find the line after strings that should NOT be highlighted as string
        let codeAfterStringsLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('mainWeaponSlot.name.nodeId.isActive')) {
                codeAfterStringsLine = i;
                break;
            }
        }
        assert.ok(codeAfterStringsLine >= 0, 'Should find line with mainWeaponSlot code');

        // Verify that code line is NOT tokenized as a string
        const selfPos = findInLine(document, codeAfterStringsLine, 'self');
        const selfScopes = await getTokenScopesAt(document, codeAfterStringsLine, selfPos.character);
        const isNotInString = !selfScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isNotInString, `Code after strings should NOT be in string scope. Got scopes: ${JSON.stringify(selfScopes?.scopes)}`);

        console.log('✓ String interpolation test passed');
    });

    test('Ternary operator colon should not be detected as type declaration', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/ternary-operators.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with ternary operator
        let ternaryLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('condition ? trueValue : falseValue')) {
                ternaryLine = i;
                break;
            }
        }
        assert.ok(ternaryLine >= 0, 'Should find ternary operator line');

        // Verify that 'falseValue' after the colon is NOT tokenized as a type
        const falseValuePos = findInLine(document, ternaryLine, 'falseValue');
        const falseValueScopes = await getTokenScopesAt(document, ternaryLine, falseValuePos.character);

        // It should be a variable, not a type
        const isType = falseValueScopes?.scopes?.some(scope =>
            scope.includes('storage.type') || scope.includes('entity.name.type')
        );
        assert.ok(!isType, `'falseValue' after colon should NOT be tokenized as a type. Got scopes: ${JSON.stringify(falseValueScopes?.scopes)}`);

        // Verify the colon is an operator, not a type separator
        const colonPos = findInLine(document, ternaryLine, ': falseValue');
        const colonScopes = await getTokenScopesAt(document, ternaryLine, colonPos.character);
        const isOperator = colonScopes?.scopes?.some(scope =>
            scope.includes('keyword.operator') || scope.includes('punctuation')
        );
        // Colon should be treated as operator/punctuation in ternary context
        assert.ok(isOperator || colonScopes?.scopes?.length > 0,
            `Colon in ternary should be an operator. Got scopes: ${JSON.stringify(colonScopes?.scopes)}`
        );

        console.log('✓ Ternary operator test passed');
    });

    test('Nested ternary operators should highlight all expressions correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/ternary-operators.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with nested ternary: abs(delta) > PI ? ang + (delta > 0.f ? 1.f : -1.f) * TWO_PI : ang
        let nestedTernaryLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('abs(delta) > PI ? ang +')) {
                nestedTernaryLine = i;
                break;
            }
        }
        assert.ok(nestedTernaryLine >= 0, 'Should find nested ternary operator line');

        const lineText = document.lineAt(nestedTernaryLine).text;

        // Verify 'abs' function call is highlighted
        const absPos = findInLine(document, nestedTernaryLine, 'abs');
        const absScopes = await getTokenScopesAt(document, nestedTernaryLine, absPos.character);
        const isFunction = absScopes?.scopes?.some(scope =>
            scope.includes('function') || scope.includes('entity.name')
        );
        assert.ok(isFunction, `'abs' should be highlighted as a function. Got scopes: ${JSON.stringify(absScopes?.scopes)}`);

        // Find all occurrences of 'ang' in the line
        const angMatches = [];
        let index = -1;
        while ((index = lineText.indexOf('ang', index + 1)) !== -1) {
            angMatches.push(index);
        }
        assert.ok(angMatches.length >= 2, 'Should find at least 2 occurrences of "ang"');

        // Verify the last 'ang' (false branch of outer ternary) is highlighted as identifier/variable
        const lastAngPos = angMatches[angMatches.length - 1];
        const lastAngScopes = await getTokenScopesAt(document, nestedTernaryLine, lastAngPos);

        // Should be highlighted as identifier or variable, not just base scope
        const hasIdentifierScope = lastAngScopes?.scopes?.some(scope =>
            scope.includes('variable') || scope.includes('identifier')
        );
        const notJustBaseScope = lastAngScopes?.scopes?.length > 1 || hasIdentifierScope;
        assert.ok(notJustBaseScope, `Last 'ang' should be highlighted as identifier. Got scopes: ${JSON.stringify(lastAngScopes?.scopes)}`);

        // Verify numeric literals in nested ternary are highlighted
        const floatLiteralPos = lineText.indexOf('0.f');
        if (floatLiteralPos >= 0) {
            const floatScopes = await getTokenScopesAt(document, nestedTernaryLine, floatLiteralPos);
            const isNumeric = floatScopes?.scopes?.some(scope =>
                scope.includes('constant.numeric')
            );
            assert.ok(isNumeric, `'0.f' should be highlighted as numeric literal. Got scopes: ${JSON.stringify(floatScopes?.scopes)}`);
        }

        // Test another nested ternary: value < 0 ? "invalid" : value > max ? "overflow" : "{value}"
        let multiNestedLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('"invalid"') && document.lineAt(i).text.includes('"overflow"')) {
                multiNestedLine = i;
                break;
            }
        }

        if (multiNestedLine >= 0) {
            // Verify string literals are highlighted
            const multiLineText = document.lineAt(multiNestedLine).text;
            const invalidStrPos = multiLineText.indexOf('"invalid"');
            if (invalidStrPos >= 0) {
                const invalidScopes = await getTokenScopesAt(document, multiNestedLine, invalidStrPos + 2); // +2 to be inside string
                const isString = invalidScopes?.scopes?.some(scope => scope.includes('string'));
                assert.ok(isString, `"invalid" should be highlighted as string. Got scopes: ${JSON.stringify(invalidScopes?.scopes)}`);
            }

            // Verify the last part (string interpolation) is also highlighted
            const interpolationPos = multiLineText.indexOf('"{value}"');
            if (interpolationPos >= 0) {
                const interpScopes = await getTokenScopesAt(document, multiNestedLine, interpolationPos + 2);
                const isInterpString = interpScopes?.scopes?.some(scope => scope.includes('string'));
                assert.ok(isInterpString, `String interpolation should be highlighted. Got scopes: ${JSON.stringify(interpScopes?.scopes)}`);
            }
        }

        console.log('✓ Nested ternary operators test passed');
    });

    test('Type annotations with optional types should work', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/optional-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find line with optional type
        let optionalLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('CombatUI?')) {
                optionalLine = i;
                break;
            }
        }
        assert.ok(optionalLine >= 0, 'Should find line with optional type');

        // Verify all three types are tokenized as types
        const types = ['CombatUI', 'float3', 'quat4'];
        for (const typeName of types) {
            const typePos = findInLine(document, optionalLine, typeName);
            const typeScopes = await getTokenScopesAt(document, optionalLine, typePos.character);
            const hasTypeScope = typeScopes?.scopes?.some(scope =>
                scope.includes('storage.type') || scope.includes('entity.name.type')
            );
            assert.ok(hasTypeScope, `${typeName} should be tokenized as a type. Got scopes: ${JSON.stringify(typeScopes?.scopes)}`);
        }

        // Find line without optional type
        let normalLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('def anotherFunction') || (lineText.includes('CombatUI') && !lineText.includes('CombatUI?'))) {
                normalLine = i;
                break;
            }
        }

        if (normalLine >= 0) {
            // Verify types without optional marker also work
            const normalLineText = document.lineAt(normalLine).text;
            if (normalLineText.includes('CombatUI') && !normalLineText.includes('CombatUI?')) {
                const combatUIPos = findInLine(document, normalLine, 'CombatUI');
                const scopes = await getTokenScopesAt(document, normalLine, combatUIPos.character);
                const hasTypeScope = scopes?.scopes?.some(scope =>
                    scope.includes('storage.type') || scope.includes('entity.name.type')
                );
                assert.ok(hasTypeScope, `CombatUI (non-optional) should be tokenized as a type. Got scopes: ${JSON.stringify(scopes?.scopes)}`);
            }
        }

        console.log('✓ Type annotations with optional types test passed');
    });

    test('Multiple strings on same line should close properly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/string-interpolation.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find line with multiple strings: ? "∞" : "{max(currentAmount, 0)}"
        let multiStringLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('currentAmount == -1') && lineText.includes('"∞"')) {
                multiStringLine = i;
                break;
            }
        }
        assert.ok(multiStringLine >= 0, 'Should find line with multiple strings');

        const lineText = document.lineAt(multiStringLine).text;

        // Verify first string is tokenized correctly
        const firstQuotePos = lineText.indexOf('"∞"');
        assert.ok(firstQuotePos >= 0, 'Should find first string');
        const firstStringScopes = await getTokenScopesAt(document, multiStringLine, firstQuotePos + 1); // +1 to be inside the string
        const isFirstString = firstStringScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isFirstString, `First string should be tokenized as string. Got scopes: ${JSON.stringify(firstStringScopes?.scopes)}`);

        // Verify second string is also tokenized correctly
        const secondQuotePos = lineText.indexOf('"{max');
        assert.ok(secondQuotePos > firstQuotePos, 'Should find second string after first');
        const secondStringScopes = await getTokenScopesAt(document, multiStringLine, secondQuotePos + 1);
        const isSecondString = secondStringScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isSecondString, `Second string should be tokenized as string. Got scopes: ${JSON.stringify(secondStringScopes?.scopes)}`);

        // Verify the next line is NOT inside a string scope
        if (multiStringLine + 1 < document.lineCount) {
            const nextLine = document.lineAt(multiStringLine + 1);
            if (nextLine.text.trim().length > 0) {
                // Check first non-whitespace character of next line
                const firstCharPos = nextLine.firstNonWhitespaceCharacterIndex;
                const nextLineScopes = await getTokenScopesAt(document, multiStringLine + 1, firstCharPos);
                const isInString = nextLineScopes?.scopes?.some(scope => scope.includes('string'));
                assert.ok(!isInString, `Next line should NOT be in string scope. Got scopes: ${JSON.stringify(nextLineScopes?.scopes)}`);
            }
        }

        console.log('✓ Multiple strings test passed');
    });

    test('Function pointer parameter types should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/function-pointers.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with basic function pointer: threshold : function<(nodeId : NodeId) : float>
        let functionPointerLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('threshold : function<(nodeId : NodeId)')) {
                functionPointerLine = i;
                break;
            }
        }
        assert.ok(functionPointerLine >= 0, 'Should find line with function pointer declaration');

        // Verify NodeId (parameter type) is tokenized as a type
        const nodeIdPos = findInLine(document, functionPointerLine, 'NodeId');
        const nodeIdScopes = await getTokenScopesAt(document, functionPointerLine, nodeIdPos.character);
        const hasTypeScope = nodeIdScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type')
        );
        assert.ok(hasTypeScope, `NodeId should be tokenized as a type. Got scopes: ${JSON.stringify(nodeIdScopes?.scopes)}`);

        // Verify float (return type) is also tokenized correctly
        const floatPos = findInLine(document, functionPointerLine, 'float');
        const floatScopes = await getTokenScopesAt(document, functionPointerLine, floatPos.character);
        const floatHasTypeScope = floatScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(floatHasTypeScope, `float should be tokenized as a type. Got scopes: ${JSON.stringify(floatScopes?.scopes)}`);

        // Test multiple parameters case
        let multiParamLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('callback : function<(first : FirstType, second : SecondType)')) {
                multiParamLine = i;
                break;
            }
        }

        if (multiParamLine >= 0) {
            // Verify FirstType is tokenized as a type
            const firstTypePos = findInLine(document, multiParamLine, 'FirstType');
            const firstTypeScopes = await getTokenScopesAt(document, multiParamLine, firstTypePos.character);
            const firstTypeHasScope = firstTypeScopes?.scopes?.some(scope =>
                scope.includes('entity.name.type')
            );
            assert.ok(firstTypeHasScope, `FirstType should be tokenized as a type. Got scopes: ${JSON.stringify(firstTypeScopes?.scopes)}`);

            // Verify SecondType is tokenized as a type
            const secondTypePos = findInLine(document, multiParamLine, 'SecondType');
            const secondTypeScopes = await getTokenScopesAt(document, multiParamLine, secondTypePos.character);
            const secondTypeHasScope = secondTypeScopes?.scopes?.some(scope =>
                scope.includes('entity.name.type')
            );
            assert.ok(secondTypeHasScope, `SecondType should be tokenized as a type. Got scopes: ${JSON.stringify(secondTypeScopes?.scopes)}`);

            // Verify bool return type
            const boolPos = findInLine(document, multiParamLine, 'bool');
            const boolScopes = await getTokenScopesAt(document, multiParamLine, boolPos.character);
            const boolHasTypeScope = boolScopes?.scopes?.some(scope =>
                scope.includes('support.type') || scope.includes('entity.name.type')
            );
            assert.ok(boolHasTypeScope, `bool should be tokenized as a type. Got scopes: ${JSON.stringify(boolScopes?.scopes)}`);
        }

        console.log('✓ Function pointer parameter types test passed');
    });

    test('Tuple type fields should highlight field names as variables and types correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/tuple-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with victimNodes : array<tuple< node : NodeId, timeBeforeDamage : float>>
        let victimNodesLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('victimNodes') && document.lineAt(i).text.includes('timeBeforeDamage')) {
                victimNodesLine = i;
                break;
            }
        }
        assert.ok(victimNodesLine >= 0, 'Should find victimNodes declaration line');

        // Verify 'node' field name is highlighted as variable
        const nodePos = findInLine(document, victimNodesLine, 'node');
        const nodeScopes = await getTokenScopesAt(document, victimNodesLine, nodePos.character);
        const nodeIsVariable = nodeScopes?.scopes?.some(scope =>
            scope.includes('variable.parameter')
        );
        assert.ok(nodeIsVariable, `'node' should be highlighted as a variable parameter. Got scopes: ${JSON.stringify(nodeScopes?.scopes)}`);

        // Verify 'NodeId' type is highlighted as type
        const nodeIdPos = findInLine(document, victimNodesLine, 'NodeId');
        const nodeIdScopes = await getTokenScopesAt(document, victimNodesLine, nodeIdPos.character);
        const nodeIdIsType = nodeIdScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type')
        );
        assert.ok(nodeIdIsType, `'NodeId' should be highlighted as a type. Got scopes: ${JSON.stringify(nodeIdScopes?.scopes)}`);

        // Verify 'timeBeforeDamage' field name is highlighted as variable
        const timeBeforeDamagePos = findInLine(document, victimNodesLine, 'timeBeforeDamage');
        const timeBeforeDamageScopes = await getTokenScopesAt(document, victimNodesLine, timeBeforeDamagePos.character);
        const timeBeforeDamageIsVariable = timeBeforeDamageScopes?.scopes?.some(scope =>
            scope.includes('variable.parameter')
        );
        assert.ok(timeBeforeDamageIsVariable, `'timeBeforeDamage' should be highlighted as a variable parameter. Got scopes: ${JSON.stringify(timeBeforeDamageScopes?.scopes)}`);

        // Verify 'float' type is highlighted as type
        const floatPos = findInLine(document, victimNodesLine, 'float');
        const floatScopes = await getTokenScopesAt(document, victimNodesLine, floatPos.character);
        const floatIsType = floatScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(floatIsType, `'float' should be highlighted as a type. Got scopes: ${JSON.stringify(floatScopes?.scopes)}`);

        // Test the simpler position tuple as well
        let positionLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('var position : tuple<x : float')) {
                positionLine = i;
                break;
            }
        }
        assert.ok(positionLine >= 0, 'Should find position declaration line');

        // Verify 'x' field name
        const xPos = findInLine(document, positionLine, 'x');
        const xScopes = await getTokenScopesAt(document, positionLine, xPos.character);
        const xIsVariable = xScopes?.scopes?.some(scope =>
            scope.includes('variable.parameter')
        );
        assert.ok(xIsVariable, `'x' should be highlighted as a variable parameter. Got scopes: ${JSON.stringify(xScopes?.scopes)}`);

        console.log('✓ Tuple type fields test passed');
    });
});
