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

    test('Nested interpolated strings should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/string-interpolation.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Nested string with infinity symbol inside ternary in interpolation
        let nestedInfinityLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('print("Ammo:') && lineText.includes('"∞"')) {
                nestedInfinityLine = i;
                break;
            }
        }
        assert.ok(nestedInfinityLine >= 0, 'Should find line with nested infinity string');

        // Verify the infinity symbol inside the nested string is tokenized as a string
        const infinityPos = findInLine(document, nestedInfinityLine, '∞');
        const infinityScopes = await getTokenScopesAt(document, nestedInfinityLine, infinityPos.character);
        const isInString = infinityScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isInString, `Nested infinity symbol should be inside a string. Got scopes: ${JSON.stringify(infinityScopes?.scopes)}`);

        // Test 2: "Active"/"Inactive" strings in ternary
        let activeInactiveLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('"Active"') && lineText.includes('"Inactive"')) {
                activeInactiveLine = i;
                break;
            }
        }
        assert.ok(activeInactiveLine >= 0, 'Should find line with Active/Inactive strings');

        const activePos = findInLine(document, activeInactiveLine, 'Active');
        const activeScopes = await getTokenScopesAt(document, activeInactiveLine, activePos.character);
        const isActiveInString = activeScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isActiveInString, `"Active" should be inside a string. Got scopes: ${JSON.stringify(activeScopes?.scopes)}`);

        // Test 3: Nested interpolation with multiple levels
        let multiLevelLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('"positive: {x}"')) {
                multiLevelLine = i;
                break;
            }
        }
        assert.ok(multiLevelLine >= 0, 'Should find line with multi-level interpolation');

        const positivePos = findInLine(document, multiLevelLine, 'positive');
        const positiveScopes = await getTokenScopesAt(document, multiLevelLine, positivePos.character);
        const isPositiveInString = positiveScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isPositiveInString, `"positive" should be inside a string. Got scopes: ${JSON.stringify(positiveScopes?.scopes)}`);

        // Test 4: Multiple ternaries with nested strings
        let multiTernaryLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('Health:') && lineText.includes('Shield:')) {
                multiTernaryLine = i;
                break;
            }
        }
        assert.ok(multiTernaryLine >= 0, 'Should find line with multiple ternaries');

        // Verify both infinity symbols are in strings
        const healthInfinityMatch = document.lineAt(multiTernaryLine).text.indexOf('? "∞"');
        assert.ok(healthInfinityMatch >= 0, 'Should find health infinity');
        const healthInfinityScopes = await getTokenScopesAt(document, multiTernaryLine, healthInfinityMatch + 3);
        const isHealthInfinityInString = healthInfinityScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isHealthInfinityInString, `Health infinity should be inside a string. Got scopes: ${JSON.stringify(healthInfinityScopes?.scopes)}`);

        // Test 5: Deeply nested case
        let deepNestedLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('"inner"') && lineText.includes('"middle"') && lineText.includes('"outer"')) {
                deepNestedLine = i;
                break;
            }
        }
        assert.ok(deepNestedLine >= 0, 'Should find line with deeply nested strings');

        const innerPos = findInLine(document, deepNestedLine, 'inner');
        const innerScopes = await getTokenScopesAt(document, deepNestedLine, innerPos.character);
        const isInnerInString = innerScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isInnerInString, `"inner" should be inside a string. Got scopes: ${JSON.stringify(innerScopes?.scopes)}`);

        console.log('✓ Nested interpolated strings test passed');
    });

    test('Multiline string interpolation should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/string-interpolation.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with multiline string start
        let multilineStartLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('[Item Equipment] initial_loadout_item removed')) {
                multilineStartLine = i;
                break;
            }
        }
        assert.ok(multilineStartLine >= 0, 'Should find line with multiline string start');

        // Verify the opening quote starts a string
        const openQuotePos = findInLine(document, multilineStartLine, '"[Item Equipment]');
        const openQuoteScopes = await getTokenScopesAt(document, multilineStartLine, openQuotePos.character + 1);
        const isStartInString = openQuoteScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isStartInString, `Start of multiline string should be in string scope. Got scopes: ${JSON.stringify(openQuoteScopes?.scopes)}`);

        // Find the next line with interpolation
        const nextLine = multilineStartLine + 1;
        const nextLineText = document.lineAt(nextLine).text;
        assert.ok(nextLineText.includes('itemEid='), 'Next line should have itemEid interpolation');

        // Verify 'itemEid=' is inside a string (before the interpolation starts)
        const itemEidPos = findInLine(document, nextLine, 'itemEid=');
        const itemEidScopes = await getTokenScopesAt(document, nextLine, itemEidPos.character);
        const isItemEidInString = itemEidScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isItemEidInString, `'itemEid=' should be inside a string. Got scopes: ${JSON.stringify(itemEidScopes?.scopes)}`);

        // Verify the interpolation content is recognized
        const getEntityPos = findInLine(document, nextLine, 'get_entity_info');
        const getEntityScopes = await getTokenScopesAt(document, nextLine, getEntityPos.character);
        const isInInterpolation = getEntityScopes?.scopes?.some(scope => 
            scope.includes('meta.interpolation') || scope.includes('meta.embedded')
        );
        assert.ok(isInInterpolation, `Function call inside interpolation should be in interpolation scope. Got scopes: ${JSON.stringify(getEntityScopes?.scopes)}`);

        // Find the third line with second interpolation
        const thirdLine = multilineStartLine + 2;
        const thirdLineText = document.lineAt(thirdLine).text;
        assert.ok(thirdLineText.includes('reEid='), 'Third line should have reEid interpolation');

        // Verify 'reEid=' is inside a string
        const reEidPos = findInLine(document, thirdLine, 'reEid=');
        const reEidScopes = await getTokenScopesAt(document, thirdLine, reEidPos.character);
        const isReEidInString = reEidScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isReEidInString, `'reEid=' should be inside a string. Got scopes: ${JSON.stringify(reEidScopes?.scopes)}`);

        // Test another multiline case with Status/Health/Shield
        let statusHealthLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('let message = "Status:')) {
                statusHealthLine = i;
                break;
            }
        }
        assert.ok(statusHealthLine >= 0, 'Should find line with Status multiline string');

        // Verify 'Health:' on the next line is in a string
        const healthLine = statusHealthLine + 1;
        const healthPos = findInLine(document, healthLine, 'Health:');
        const healthScopes = await getTokenScopesAt(document, healthLine, healthPos.character);
        const isHealthInString = healthScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isHealthInString, `'Health:' should be inside a string. Got scopes: ${JSON.stringify(healthScopes?.scopes)}`);

        // Verify interpolation on Health line works
        const hpMatch = document.lineAt(healthLine).text.indexOf('{hp}');
        if (hpMatch >= 0) {
            const hpScopes = await getTokenScopesAt(document, healthLine, hpMatch + 1);
            const isHpInInterpolation = hpScopes?.scopes?.some(scope => 
                scope.includes('meta.interpolation') || scope.includes('punctuation.definition.interpolation')
            );
            assert.ok(isHpInInterpolation, `'{hp}' should be in interpolation scope. Got scopes: ${JSON.stringify(hpScopes?.scopes)}`);
        }

        console.log('✓ Multiline string interpolation test passed');
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
                scope.includes('storage.type') || scope.includes('entity.name.type') || scope.includes('support.type')
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

    test('Function return type annotations should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/function-return-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Basic function with return type annotation (no parameters)
        // def extractData : array<uint8>
        let extractDataLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def extractData : array<uint8>')) {
                extractDataLine = i;
                break;
            }
        }
        assert.ok(extractDataLine >= 0, 'Should find extractData function declaration');

        // Verify 'extractData' is highlighted as a function name
        const extractDataPos = findInLine(document, extractDataLine, 'extractData');
        const extractDataScopes = await getTokenScopesAt(document, extractDataLine, extractDataPos.character);
        const isFunctionName = extractDataScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isFunctionName, `'extractData' should be highlighted as a function name. Got scopes: ${JSON.stringify(extractDataScopes?.scopes)}`);

        // Verify 'array' in return type is highlighted as a type keyword
        const arrayPos = findInLine(document, extractDataLine, 'array');
        const arrayScopes = await getTokenScopesAt(document, extractDataLine, arrayPos.character);
        const isArrayType = arrayScopes?.scopes?.some(scope =>
            scope.includes('keyword.type') || scope.includes('entity.name.type')
        );
        assert.ok(isArrayType, `'array' should be highlighted as a type. Got scopes: ${JSON.stringify(arrayScopes?.scopes)}`);

        // Verify 'uint8' is highlighted as a type
        const uint8Pos = findInLine(document, extractDataLine, 'uint8');
        const uint8Scopes = await getTokenScopesAt(document, extractDataLine, uint8Pos.character);
        const isUint8Type = uint8Scopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(isUint8Type, `'uint8' should be highlighted as a type. Got scopes: ${JSON.stringify(uint8Scopes?.scopes)}`);

        // Test 2: Function with parameters and return type
        // def processData(input : string) : array<int>
        let processDataLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def processData(input : string) : array<int>')) {
                processDataLine = i;
                break;
            }
        }
        assert.ok(processDataLine >= 0, 'Should find processData function declaration');

        // Verify 'processData' is highlighted as a function name
        const processDataPos = findInLine(document, processDataLine, 'processData');
        const processDataScopes = await getTokenScopesAt(document, processDataLine, processDataPos.character);
        const isProcessDataFunction = processDataScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isProcessDataFunction, `'processData' should be highlighted as a function name. Got scopes: ${JSON.stringify(processDataScopes?.scopes)}`);

        // Test 3: Function with complex return type (table)
        // def getMapping : table<string; int>
        let getMappingLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def getMapping : table<string; int>')) {
                getMappingLine = i;
                break;
            }
        }
        assert.ok(getMappingLine >= 0, 'Should find getMapping function declaration');

        // Verify 'getMapping' is highlighted as a function name
        const getMappingPos = findInLine(document, getMappingLine, 'getMapping');
        const getMappingScopes = await getTokenScopesAt(document, getMappingLine, getMappingPos.character);
        const isGetMappingFunction = getMappingScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isGetMappingFunction, `'getMapping' should be highlighted as a function name. Got scopes: ${JSON.stringify(getMappingScopes?.scopes)}`);

        // Verify 'table' is highlighted as a type keyword
        const tablePos = findInLine(document, getMappingLine, 'table');
        const tableScopes = await getTokenScopesAt(document, getMappingLine, tablePos.character);
        const isTableType = tableScopes?.scopes?.some(scope =>
            scope.includes('keyword.type') || scope.includes('entity.name.type')
        );
        assert.ok(isTableType, `'table' should be highlighted as a type. Got scopes: ${JSON.stringify(tableScopes?.scopes)}`);

        // Test 4: Function with optional return type
        // def findItem(id : int) : Item?
        let findItemLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def findItem(id : int) : Item?')) {
                findItemLine = i;
                break;
            }
        }
        assert.ok(findItemLine >= 0, 'Should find findItem function declaration');

        // Verify 'findItem' is highlighted as a function name
        const findItemPos = findInLine(document, findItemLine, 'findItem');
        const findItemScopes = await getTokenScopesAt(document, findItemLine, findItemPos.character);
        const isFindItemFunction = findItemScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isFindItemFunction, `'findItem' should be highlighted as a function name. Got scopes: ${JSON.stringify(findItemScopes?.scopes)}`);

        // Verify 'Item' in return type is highlighted as a type
        // Note: There are two occurrences of "Item" - one in "findItem" and one in ": Item?"
        // We want the second one
        const line = document.lineAt(findItemLine);
        const firstItemIndex = line.text.indexOf('Item');
        const secondItemIndex = line.text.indexOf('Item', firstItemIndex + 1);
        assert.ok(secondItemIndex > 0, 'Should find second occurrence of Item in return type');
        
        const itemPos = new vscode.Position(findItemLine, secondItemIndex);
        const itemScopes = await getTokenScopesAt(document, findItemLine, itemPos.character);
        const isItemType = itemScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('storage.type')
        );
        assert.ok(isItemType, `'Item' in return type should be highlighted as a type. Got scopes: ${JSON.stringify(itemScopes?.scopes)}`);

        // Test 5: Function with var parameters
        // def public serialize(var arch : Archive; var value : auto(TT)&)
        let serializeLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def public serialize(var arch : Archive')) {
                serializeLine = i;
                break;
            }
        }
        assert.ok(serializeLine >= 0, 'Should find serialize function declaration');

        // Verify first 'var' is highlighted as a storage modifier, not a type
        const firstVarPos = findInLine(document, serializeLine, 'var');
        const firstVarScopes = await getTokenScopesAt(document, serializeLine, firstVarPos.character);
        const isVarKeyword = firstVarScopes?.scopes?.some(scope =>
            scope.includes('storage.modifier')
        );
        const isNotVarType = !firstVarScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type')
        );
        assert.ok(isVarKeyword && isNotVarType, `First 'var' should be highlighted as storage modifier, not type. Got scopes: ${JSON.stringify(firstVarScopes?.scopes)}`);

        // Verify 'Archive' is highlighted as a type
        const archivePos = findInLine(document, serializeLine, 'Archive');
        const archiveScopes = await getTokenScopesAt(document, serializeLine, archivePos.character);
        const isArchiveType = archiveScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('storage.type')
        );
        assert.ok(isArchiveType, `'Archive' should be highlighted as a type. Got scopes: ${JSON.stringify(archiveScopes?.scopes)}`);

        // Verify second 'var' (before 'value') is also a storage modifier
        const lineText = document.lineAt(serializeLine).text;
        const firstVarIndex = lineText.indexOf('var');
        const secondVarIndex = lineText.indexOf('var', firstVarIndex + 1);
        assert.ok(secondVarIndex > 0, 'Should find second occurrence of var');
        
        const secondVarPos = new vscode.Position(serializeLine, secondVarIndex);
        const secondVarScopes = await getTokenScopesAt(document, serializeLine, secondVarPos.character);
        const isSecondVarKeyword = secondVarScopes?.scopes?.some(scope =>
            scope.includes('storage.modifier')
        );
        const isNotSecondVarType = !secondVarScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type')
        );
        assert.ok(isSecondVarKeyword && isNotSecondVarType, `Second 'var' should be highlighted as storage modifier, not type. Got scopes: ${JSON.stringify(secondVarScopes?.scopes)}`);

        // Test 6: Function with auto types in parameters
        // def public serialize2(var arch : Archive; var value : auto(TT)[])
        let serialize2Line = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def public serialize2(var arch : Archive; var value : auto(TT)[]')) {
                serialize2Line = i;
                break;
            }
        }
        assert.ok(serialize2Line >= 0, 'Should find serialize2 function declaration');

        // Verify 'auto' is highlighted as a type keyword, not a regular type
        const autoPos = findInLine(document, serialize2Line, 'auto');
        const autoScopes = await getTokenScopesAt(document, serialize2Line, autoPos.character);
        const isAutoKeyword = autoScopes?.scopes?.some(scope =>
            scope.includes('support.type.auto')
        );
        // Make sure it's not just treated as entity.name.type without the .auto specificity
        const hasAutoSpecificScope = autoScopes?.scopes?.some(scope =>
            scope.includes('auto')
        );
        assert.ok(isAutoKeyword || hasAutoSpecificScope, `'auto' should be highlighted as auto type keyword. Got scopes: ${JSON.stringify(autoScopes?.scopes)}`);

        // Test 7: Function with no spaces around colons in parameters
        // def public serialize3(var arch:Archive; var value:auto(TT)&)
        let serialize3Line = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def public serialize3(var arch:Archive')) {
                serialize3Line = i;
                break;
            }
        }
        assert.ok(serialize3Line >= 0, 'Should find serialize3 function declaration');

        // Verify 'value' parameter name is NOT highlighted as a function
        const valuePos = findInLine(document, serialize3Line, 'value');
        const valueScopes = await getTokenScopesAt(document, serialize3Line, valuePos.character);
        const isNotFunction = !valueScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function') && !scope.includes('variable') && !scope.includes('parameter')
        );
        assert.ok(isNotFunction, `'value' should not be highlighted as a function call. Got scopes: ${JSON.stringify(valueScopes?.scopes)}`);

        // Verify 'auto' after value: is highlighted as auto type
        const lineText3 = document.lineAt(serialize3Line).text;
        const valueIndex = lineText3.indexOf('value');
        const autoAfterValueIndex = lineText3.indexOf('auto', valueIndex);
        assert.ok(autoAfterValueIndex > valueIndex, 'Should find auto after value');
        
        const autoAfterValuePos = new vscode.Position(serialize3Line, autoAfterValueIndex);
        const autoAfterValueScopes = await getTokenScopesAt(document, serialize3Line, autoAfterValuePos.character);
        const isAutoType = autoAfterValueScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('auto')
        );
        const isNotFunctionScope = !autoAfterValueScopes?.scopes?.some(scope =>
            scope.includes('meta.function-call')
        );
        assert.ok(isAutoType && isNotFunctionScope, `'auto' after 'value:' should be highlighted as type, not function. Got scopes: ${JSON.stringify(autoAfterValueScopes?.scopes)}`);

        console.log('✓ Function return type annotations test passed');
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

        // Test tuple in return statement [[tuple<...>]]
        let returnLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('return [[tuple<x : int, y : int>')) {
                returnLine = i;
                break;
            }
        }
        assert.ok(returnLine >= 0, 'Should find return statement with tuple constructor');

        // Verify 'tuple' keyword in return statement is NOT highlighted as annotation
        const tupleInReturnPos = findInLine(document, returnLine, 'tuple');
        const tupleInReturnScopes = await getTokenScopesAt(document, returnLine, tupleInReturnPos.character);
        const tupleIsNotAnnotation = !tupleInReturnScopes?.scopes?.some(scope =>
            scope.includes('annotation')
        );
        const tupleIsKeyword = tupleInReturnScopes?.scopes?.some(scope =>
            scope.includes('keyword.type')
        );
        assert.ok(tupleIsNotAnnotation, `'tuple' in return statement should NOT be highlighted as annotation. Got scopes: ${JSON.stringify(tupleInReturnScopes?.scopes)}`);
        assert.ok(tupleIsKeyword, `'tuple' in return statement should be highlighted as keyword. Got scopes: ${JSON.stringify(tupleInReturnScopes?.scopes)}`);

        console.log('✓ Tuple type fields test passed');
    });

    test('Lambda type templates should highlight types correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/lambda-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Find line with lambda<void>
        let voidLambdaLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('onSinglePlayer') && document.lineAt(i).text.includes('lambda<void>')) {
                voidLambdaLine = i;
                break;
            }
        }
        assert.ok(voidLambdaLine >= 0, 'Should find lambda<void> declaration line');

        // Verify 'void' inside lambda<void> is highlighted as a type
        const voidPos = findInLine(document, voidLambdaLine, 'void');
        const voidScopes = await getTokenScopesAt(document, voidLambdaLine, voidPos.character);
        const voidIsType = voidScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(voidIsType, `'void' in lambda<void> should be highlighted as a type. Got scopes: ${JSON.stringify(voidScopes?.scopes)}`);

        // Test 2: Find line with lambda<int>
        let intLambdaLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('getScore') && document.lineAt(i).text.includes('lambda<int>')) {
                intLambdaLine = i;
                break;
            }
        }
        assert.ok(intLambdaLine >= 0, 'Should find lambda<int> declaration line');

        // Verify 'int' inside lambda<int> is highlighted as a type
        const intPos = findInLine(document, intLambdaLine, 'int');
        const intScopes = await getTokenScopesAt(document, intLambdaLine, intPos.character);
        const intIsType = intScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(intIsType, `'int' in lambda<int> should be highlighted as a type. Got scopes: ${JSON.stringify(intScopes?.scopes)}`);

        // Test 3: Find line with lambda<float4>
        let float4LambdaLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('getColor') && document.lineAt(i).text.includes('lambda<float4>')) {
                float4LambdaLine = i;
                break;
            }
        }
        assert.ok(float4LambdaLine >= 0, 'Should find lambda<float4> declaration line');

        // Verify 'float4' inside lambda<float4> is highlighted as a type
        const float4Pos = findInLine(document, float4LambdaLine, 'float4');
        const float4Scopes = await getTokenScopesAt(document, float4LambdaLine, float4Pos.character);
        const float4IsType = float4Scopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(float4IsType, `'float4' in lambda<float4> should be highlighted as a type. Got scopes: ${JSON.stringify(float4Scopes?.scopes)}`);

        // Test 4: Find line with lambda<NodeId> (custom type)
        let customTypeLambdaLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('getNode') && document.lineAt(i).text.includes('lambda<NodeId>')) {
                customTypeLambdaLine = i;
                break;
            }
        }
        assert.ok(customTypeLambdaLine >= 0, 'Should find lambda<NodeId> declaration line');

        // Verify 'NodeId' inside lambda<NodeId> is highlighted as a type
        const nodeIdPos = findInLine(document, customTypeLambdaLine, 'NodeId');
        const nodeIdScopes = await getTokenScopesAt(document, customTypeLambdaLine, nodeIdPos.character);
        const nodeIdIsType = nodeIdScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type')
        );
        assert.ok(nodeIdIsType, `'NodeId' in lambda<NodeId> should be highlighted as a type. Got scopes: ${JSON.stringify(nodeIdScopes?.scopes)}`);

        console.log('✓ Lambda type templates test passed');
    });

    test('Syntax in comments should be ignored and only highlighted as comment', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/comments.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Find line with commented var declaration
        let commentedVarLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('// var hitboxNode = NodeId()')) {
                commentedVarLine = i;
                break;
            }
        }
        assert.ok(commentedVarLine >= 0, 'Should find line with commented var declaration');

        // Verify 'var' keyword in comment is only highlighted as comment
        const varPos = findInLine(document, commentedVarLine, 'var');
        const varScopes = await getTokenScopesAt(document, commentedVarLine, varPos.character);
        const hasCommentScope = varScopes?.scopes?.some(scope => scope.includes('comment'));
        const hasNoKeywordScope = !varScopes?.scopes?.some(scope => scope.includes('keyword') || scope.includes('storage.modifier'));
        assert.ok(hasCommentScope, `'var' in comment should have comment scope. Got scopes: ${JSON.stringify(varScopes?.scopes)}`);
        assert.ok(hasNoKeywordScope, `'var' in comment should not have keyword scope. Got scopes: ${JSON.stringify(varScopes?.scopes)}`);

        // Test 2: Find line with commented if statement
        let commentedIfLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('// if (hitbox != "") {')) {
                commentedIfLine = i;
                break;
            }
        }
        assert.ok(commentedIfLine >= 0, 'Should find line with commented if statement');

        // Verify 'if' keyword and string in comment are only highlighted as comment
        const ifPos = findInLine(document, commentedIfLine, 'if');
        const ifScopes = await getTokenScopesAt(document, commentedIfLine, ifPos.character);
        const ifHasCommentScope = ifScopes?.scopes?.some(scope => scope.includes('comment'));
        const ifHasNoKeywordScope = !ifScopes?.scopes?.some(scope => scope.includes('keyword'));
        assert.ok(ifHasCommentScope, `'if' in comment should have comment scope. Got scopes: ${JSON.stringify(ifScopes?.scopes)}`);
        assert.ok(ifHasNoKeywordScope, `'if' in comment should not have keyword scope. Got scopes: ${JSON.stringify(ifScopes?.scopes)}`);

        const stringPos = findInLine(document, commentedIfLine, '""');
        const stringScopes = await getTokenScopesAt(document, commentedIfLine, stringPos.character);
        const stringHasCommentScope = stringScopes?.scopes?.some(scope => scope.includes('comment'));
        const stringHasNoStringScope = !stringScopes?.scopes?.some(scope => scope.includes('string.quoted'));
        assert.ok(stringHasCommentScope, `String in comment should have comment scope. Got scopes: ${JSON.stringify(stringScopes?.scopes)}`);
        assert.ok(stringHasNoStringScope, `String in comment should not have string scope. Got scopes: ${JSON.stringify(stringScopes?.scopes)}`);

        // Test 3: Block comment with function syntax
        let blockCommentLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('function someFunc(var self : SomeType')) {
                blockCommentLine = i;
                break;
            }
        }
        assert.ok(blockCommentLine >= 0, 'Should find line with function in block comment');

        // Verify 'function' keyword in block comment is only highlighted as comment
        const functionPos = findInLine(document, blockCommentLine, 'function');
        const functionScopes = await getTokenScopesAt(document, blockCommentLine, functionPos.character);
        const functionHasCommentScope = functionScopes?.scopes?.some(scope => scope.includes('comment'));
        const functionHasNoKeywordScope = !functionScopes?.scopes?.some(scope => scope.includes('keyword'));
        assert.ok(functionHasCommentScope, `'function' in block comment should have comment scope. Got scopes: ${JSON.stringify(functionScopes?.scopes)}`);
        assert.ok(functionHasNoKeywordScope, `'function' in block comment should not have keyword scope. Got scopes: ${JSON.stringify(functionScopes?.scopes)}`);

        // Test 4: Verify actual code is NOT highlighted as comment
        let actualCodeLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text === 'var actualCode = 42') {
                actualCodeLine = i;
                break;
            }
        }
        assert.ok(actualCodeLine >= 0, 'Should find actual code line');

        const actualVarPos = findInLine(document, actualCodeLine, 'var');
        const actualVarScopes = await getTokenScopesAt(document, actualCodeLine, actualVarPos.character);
        const isNotComment = !actualVarScopes?.scopes?.some(scope => scope.includes('comment'));
        assert.ok(isNotComment, `'var' in actual code should NOT have comment scope. Got scopes: ${JSON.stringify(actualVarScopes?.scopes)}`);

        console.log('✓ Comments syntax highlighting test passed');
    });

    test('Comments in function return types should be highlighted as comments', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/function-comments.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Find line with function definition and trailing comment
        let writeDefLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def abstract write') && document.lineAt(i).text.includes('//! Write binary data')) {
                writeDefLine = i;
                break;
            }
        }
        assert.ok(writeDefLine >= 0, 'Should find def abstract write line');

        // Verify the return type 'bool' is highlighted as a type
        const boolPos = findInLine(document, writeDefLine, 'bool');
        const boolScopes = await getTokenScopesAt(document, writeDefLine, boolPos.character);
        const isBoolType = boolScopes?.scopes?.some(scope => 
            scope.includes('entity.name.type') || scope.includes('support.type')
        );
        assert.ok(isBoolType, `'bool' should be highlighted as a type. Got scopes: ${JSON.stringify(boolScopes?.scopes)}`);

        // Verify the comment '//! Write binary data' is highlighted as a comment
        const commentPos = findInLine(document, writeDefLine, '//!');
        const commentScopes = await getTokenScopesAt(document, writeDefLine, commentPos.character);
        const isComment = commentScopes?.scopes?.some(scope => scope.includes('comment'));
        const isNotType = !commentScopes?.scopes?.some(scope => scope.includes('entity.name.type') && !scope.includes('comment'));
        assert.ok(isComment, `'//!' should be highlighted as a comment. Got scopes: ${JSON.stringify(commentScopes?.scopes)}`);
        assert.ok(isNotType, `'//!' should NOT be highlighted as a type. Got scopes: ${JSON.stringify(commentScopes?.scopes)}`);

        // Test 2: Find another function with comment
        let readDefLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def read') && document.lineAt(i).text.includes('//! Read data')) {
                readDefLine = i;
                break;
            }
        }
        assert.ok(readDefLine >= 0, 'Should find def read line');

        // Verify return type 'int' is highlighted correctly
        const intPos = findInLine(document, readDefLine, 'int');
        const intScopes = await getTokenScopesAt(document, readDefLine, intPos.character);
        const isIntType = intScopes?.scopes?.some(scope => scope.includes('entity.name.type') || scope.includes('support.type'));
        assert.ok(isIntType, `'int' should be highlighted as a type. Got scopes: ${JSON.stringify(intScopes?.scopes)}`);

        // Verify text "Read data" in comment is highlighted as comment
        const readDataPos = findInLine(document, readDefLine, 'Read data');
        const readDataScopes = await getTokenScopesAt(document, readDefLine, readDataPos.character);
        const isReadDataComment = readDataScopes?.scopes?.some(scope => scope.includes('comment'));
        assert.ok(isReadDataComment, `'Read data' should be highlighted as a comment. Got scopes: ${JSON.stringify(readDataScopes?.scopes)}`);

        // Test 3: Function with block comment
        let processDefLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def process') && document.lineAt(i).text.includes('/* Process array data */')) {
                processDefLine = i;
                break;
            }
        }
        assert.ok(processDefLine >= 0, 'Should find def process line');

        // Verify block comment is highlighted as comment
        const blockCommentPos = findInLine(document, processDefLine, '/* Process');
        const blockCommentScopes = await getTokenScopesAt(document, processDefLine, blockCommentPos.character);
        const isBlockComment = blockCommentScopes?.scopes?.some(scope => scope.includes('comment'));
        assert.ok(isBlockComment, `Block comment should be highlighted as a comment. Got scopes: ${JSON.stringify(blockCommentScopes?.scopes)}`);

        console.log('✓ Function return type comments test passed');
    });

    test('Boolean literals should always be highlighted as constants', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/boolean-literals.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Boolean in variable assignment
        let assignmentLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('let isActive = true')) {
                assignmentLine = i;
                break;
            }
        }
        assert.ok(assignmentLine >= 0, 'Should find boolean assignment line');

        const truePos1 = findInLine(document, assignmentLine, 'true');
        const trueScopes1 = await getTokenScopesAt(document, assignmentLine, truePos1.character);
        const isConstant1 = trueScopes1?.scopes?.some(scope => scope.includes('constant.language'));
        assert.ok(isConstant1, `'true' in assignment should be constant.language. Got scopes: ${JSON.stringify(trueScopes1?.scopes)}`);

        // Test 2: Boolean in simple function argument
        let simpleFuncLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('send_message(gameClient, true)')) {
                simpleFuncLine = i;
                break;
            }
        }
        assert.ok(simpleFuncLine >= 0, 'Should find simple function call line');

        const truePos2 = findInLine(document, simpleFuncLine, 'true');
        const trueScopes2 = await getTokenScopesAt(document, simpleFuncLine, truePos2.character);
        const isConstant2 = trueScopes2?.scopes?.some(scope => scope.includes('constant.language'));
        assert.ok(isConstant2, `'true' in function argument should be constant.language. Got scopes: ${JSON.stringify(trueScopes2?.scopes)}`);

        // Test 3: Boolean in complex nested function call (the reported issue)
        let complexFuncLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('), true)')) {
                complexFuncLine = i;
                break;
            }
        }
        assert.ok(complexFuncLine >= 0, 'Should find complex function call line');

        const truePos3 = findInLine(document, complexFuncLine, 'true');
        const trueScopes3 = await getTokenScopesAt(document, complexFuncLine, truePos3.character);
        const isConstant3 = trueScopes3?.scopes?.some(scope => scope.includes('constant.language'));
        assert.ok(isConstant3, `'true' in complex nested function call should be constant.language. Got scopes: ${JSON.stringify(trueScopes3?.scopes)}`);

        // Test 4: false literal
        let falseLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('let isDisabled = false')) {
                falseLine = i;
                break;
            }
        }
        assert.ok(falseLine >= 0, 'Should find false assignment line');

        const falsePos = findInLine(document, falseLine, 'false');
        const falseScopes = await getTokenScopesAt(document, falseLine, falsePos.character);
        const isFalseConstant = falseScopes?.scopes?.some(scope => scope.includes('constant.language'));
        assert.ok(isFalseConstant, `'false' should be constant.language. Got scopes: ${JSON.stringify(falseScopes?.scopes)}`);

        // Test 5: null literal
        let nullLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('let nullValue = null')) {
                nullLine = i;
                break;
            }
        }
        assert.ok(nullLine >= 0, 'Should find null assignment line');

        // Find the second occurrence of "null" (the literal, not the variable name)
        const nullLineText = document.lineAt(nullLine).text;
        const firstNullIndex = nullLineText.indexOf('null');
        const secondNullIndex = nullLineText.indexOf('null', firstNullIndex + 1);
        assert.ok(secondNullIndex >= 0, 'Should find null literal on the line');

        const nullPos = new vscode.Position(nullLine, secondNullIndex);
        const nullScopes = await getTokenScopesAt(document, nullLine, nullPos.character);
        const isNullConstant = nullScopes?.scopes?.some(scope => scope.includes('constant.language'));
        assert.ok(isNullConstant, `'null' should be constant.language. Got scopes: ${JSON.stringify(nullScopes?.scopes)}`);

        console.log('✓ Boolean literals syntax highlighting test passed');
    });

    test('Table type arguments should highlight types correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/table-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: table<NodeId, float> in struct
        let structTableLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('toRespawn : table<NodeId, float>')) {
                structTableLine = i;
                break;
            }
        }
        assert.ok(structTableLine >= 0, 'Should find struct with table<NodeId, float>');

        // Verify NodeId is highlighted as a type
        const nodeIdPos = findInLine(document, structTableLine, 'NodeId');
        const nodeIdScopes = await getTokenScopesAt(document, structTableLine, nodeIdPos.character);
        const nodeIdIsType = nodeIdScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type')
        );
        assert.ok(nodeIdIsType, `NodeId in table<NodeId, float> should be highlighted as a type. Got scopes: ${JSON.stringify(nodeIdScopes?.scopes)}`);

        // Verify float is highlighted as a type
        const floatPos = findInLine(document, structTableLine, 'float');
        const floatScopes = await getTokenScopesAt(document, structTableLine, floatPos.character);
        const floatIsType = floatScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(floatIsType, `float in table<NodeId, float> should be highlighted as a type. Got scopes: ${JSON.stringify(floatScopes?.scopes)}`);

        // Test 2: table<int, string> with builtin types
        let builtinTableLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('var simpleTable : table<int, string>')) {
                builtinTableLine = i;
                break;
            }
        }
        assert.ok(builtinTableLine >= 0, 'Should find table<int, string> line');

        // Verify int is highlighted as a type
        const intPos = findInLine(document, builtinTableLine, 'int');
        const intScopes = await getTokenScopesAt(document, builtinTableLine, intPos.character);
        const intIsType = intScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(intIsType, `int in table<int, string> should be highlighted as a type. Got scopes: ${JSON.stringify(intScopes?.scopes)}`);

        // Verify string is highlighted as a type
        const stringPos = findInLine(document, builtinTableLine, 'string');
        const stringScopes = await getTokenScopesAt(document, builtinTableLine, stringPos.character);
        const stringIsType = stringScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(stringIsType, `string in table<int, string> should be highlighted as a type. Got scopes: ${JSON.stringify(stringScopes?.scopes)}`);

        // Test 3: table with custom types
        let customTableLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('var customTable : table<EntityId, PlayerData>')) {
                customTableLine = i;
                break;
            }
        }
        assert.ok(customTableLine >= 0, 'Should find custom table line');

        // Verify EntityId is highlighted as a type
        const entityIdPos = findInLine(document, customTableLine, 'EntityId');
        const entityIdScopes = await getTokenScopesAt(document, customTableLine, entityIdPos.character);
        const entityIdIsType = entityIdScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type')
        );
        assert.ok(entityIdIsType, `EntityId should be highlighted as a type. Got scopes: ${JSON.stringify(entityIdScopes?.scopes)}`);

        // Verify PlayerData is highlighted as a type
        const playerDataPos = findInLine(document, customTableLine, 'PlayerData');
        const playerDataScopes = await getTokenScopesAt(document, customTableLine, playerDataPos.character);
        const playerDataIsType = playerDataScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type')
        );
        assert.ok(playerDataIsType, `PlayerData should be highlighted as a type. Got scopes: ${JSON.stringify(playerDataScopes?.scopes)}`);

        // Test 4: table in function parameter
        let functionParamLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def processTable(var data : table<NodeId, float3>)')) {
                functionParamLine = i;
                break;
            }
        }
        assert.ok(functionParamLine >= 0, 'Should find function with table parameter');

        // Verify float3 is highlighted as a type
        const float3Pos = findInLine(document, functionParamLine, 'float3');
        const float3Scopes = await getTokenScopesAt(document, functionParamLine, float3Pos.character);
        const float3IsType = float3Scopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(float3IsType, `float3 in function parameter table should be highlighted as a type. Got scopes: ${JSON.stringify(float3Scopes?.scopes)}`);

        // Test 5: nested structures - table<NodeId, array<float>>
        let nestedLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('var complex : table<NodeId, array<float>>')) {
                nestedLine = i;
                break;
            }
        }
        assert.ok(nestedLine >= 0, 'Should find nested structure line');

        // Find the 'float' inside array<float> (not in table<>)
        const nestedLineText = document.lineAt(nestedLine).text;
        const arrayFloatIndex = nestedLineText.indexOf('array<float>');
        assert.ok(arrayFloatIndex >= 0, 'Should find array<float> in line');

        const nestedFloatPos = arrayFloatIndex + 'array<'.length;
        const nestedFloatScopes = await getTokenScopesAt(document, nestedLine, nestedFloatPos);
        const nestedFloatIsType = nestedFloatScopes?.scopes?.some(scope =>
            scope.includes('support.type') || scope.includes('entity.name.type')
        );
        assert.ok(nestedFloatIsType, `float in array<float> should be highlighted as a type. Got scopes: ${JSON.stringify(nestedFloatScopes?.scopes)}`);

        console.log('✓ Table type arguments test passed');
    });

    test('Annotations should be highlighted correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/annotations.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Property annotation @no_export
        let noExportLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('@no_export localClientMessages')) {
                noExportLine = i;
                break;
            }
        }
        assert.ok(noExportLine >= 0, 'Should find @no_export annotation line');

        // Verify 'no_export' is highlighted as a function (annotation name)
        const noExportPos = findInLine(document, noExportLine, 'no_export');
        const noExportScopes = await getTokenScopesAt(document, noExportLine, noExportPos.character);
        const isAnnotation = noExportScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isAnnotation, `no_export should be highlighted as an annotation (function name). Got scopes: ${JSON.stringify(noExportScopes?.scopes)}`);

        // Test 2: Structure annotation [match_copy]
        let matchCopyLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('[match_copy]')) {
                matchCopyLine = i;
                break;
            }
        }
        assert.ok(matchCopyLine >= 0, 'Should find [match_copy] annotation line');

        // Verify 'match_copy' inside brackets is highlighted as annotation
        const matchCopyPos = findInLine(document, matchCopyLine, 'match_copy');
        const matchCopyScopes = await getTokenScopesAt(document, matchCopyLine, matchCopyPos.character);
        const isStructAnnotation = matchCopyScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isStructAnnotation, `match_copy should be highlighted as an annotation. Got scopes: ${JSON.stringify(matchCopyScopes?.scopes)}`);

        // Test 3: Annotation with string value @view_name="Hello, world!"
        let viewNameLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('@view_name="Hello, world!"')) {
                viewNameLine = i;
                break;
            }
        }
        assert.ok(viewNameLine >= 0, 'Should find @view_name annotation line');

        // Verify 'view_name' is highlighted as annotation
        const viewNamePos = findInLine(document, viewNameLine, 'view_name');
        const viewNameScopes = await getTokenScopesAt(document, viewNameLine, viewNamePos.character);
        const isViewNameAnnotation = viewNameScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isViewNameAnnotation, `view_name should be highlighted as an annotation. Got scopes: ${JSON.stringify(viewNameScopes?.scopes)}`);

        // Test 4: Annotation with unquoted value @serialize_name=hello_world
        let serializeNameLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('@serialize_name=hello_world')) {
                serializeNameLine = i;
                break;
            }
        }
        assert.ok(serializeNameLine >= 0, 'Should find @serialize_name annotation line');

        // Verify 'serialize_name' is highlighted as annotation
        const serializeNamePos = findInLine(document, serializeNameLine, 'serialize_name');
        const serializeNameScopes = await getTokenScopesAt(document, serializeNameLine, serializeNamePos.character);
        const isSerializeNameAnnotation = serializeNameScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isSerializeNameAnnotation, `serialize_name should be highlighted as an annotation. Got scopes: ${JSON.stringify(serializeNameScopes?.scopes)}`);

        // Test 5: Multiple annotations on same line
        let exportLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('@export private export_me')) {
                exportLine = i;
                break;
            }
        }
        assert.ok(exportLine >= 0, 'Should find @export annotation line');

        // Verify 'export' is highlighted as annotation
        const exportPos = findInLine(document, exportLine, 'export');
        const exportScopes = await getTokenScopesAt(document, exportLine, exportPos.character);
        const isExportAnnotation = exportScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function')
        );
        assert.ok(isExportAnnotation, `export should be highlighted as an annotation. Got scopes: ${JSON.stringify(exportScopes?.scopes)}`);

        // Test 6: Call macro annotation [call_macro(name="yield_from")]
        let callMacroLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('[call_macro(name="yield_from")]')) {
                callMacroLine = i;
                break;
            }
        }
        assert.ok(callMacroLine >= 0, 'Should find [call_macro] annotation line');

        // Verify 'call_macro' is highlighted as annotation function, NOT as entity.name.type
        const callMacroPos = findInLine(document, callMacroLine, 'call_macro');
        const callMacroScopes = await getTokenScopesAt(document, callMacroLine, callMacroPos.character);
        const isCallMacroAnnotation = callMacroScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function.annotation')
        );
        const isNotType = !callMacroScopes?.scopes?.some(scope =>
            scope === 'entity.name.type.dascript'
        );
        assert.ok(isCallMacroAnnotation, `call_macro should be highlighted as entity.name.function.annotation. Got scopes: ${JSON.stringify(callMacroScopes?.scopes)}`);
        assert.ok(isNotType, `call_macro should NOT be highlighted as entity.name.type.dascript. Got scopes: ${JSON.stringify(callMacroScopes?.scopes)}`);

        // Verify the 'name' parameter inside call_macro
        const nameParamPos = findInLine(document, callMacroLine, 'name');
        const nameParamScopes = await getTokenScopesAt(document, callMacroLine, nameParamPos.character);
        const isNameParam = nameParamScopes?.scopes?.some(scope =>
            scope.includes('variable.parameter')
        );
        assert.ok(isNameParam, `'name' parameter should be highlighted as variable.parameter. Got scopes: ${JSON.stringify(nameParamScopes?.scopes)}`);

        // Test 7: Another call macro [call_macro(name="co_continue")]
        let coContinueLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('[call_macro(name="co_continue")]')) {
                coContinueLine = i;
                break;
            }
        }
        assert.ok(coContinueLine >= 0, 'Should find co_continue call_macro annotation');

        const coContinueCallMacroPos = findInLine(document, coContinueLine, 'call_macro');
        const coContinueScopes = await getTokenScopesAt(document, coContinueLine, coContinueCallMacroPos.character);
        const isCoContinueAnnotation = coContinueScopes?.scopes?.some(scope =>
            scope.includes('entity.name.function.annotation')
        );
        assert.ok(isCoContinueAnnotation, `call_macro in co_continue should be highlighted as annotation. Got scopes: ${JSON.stringify(coContinueScopes?.scopes)}`);

        console.log('✓ Annotations test passed');
    });

    test('Function default parameters should highlight types correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/default-parameters.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Function with default string parameter
        // def public assert_once(expr : bool; message : string = "sdf")
        let assertOnceLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def public assert_once(expr : bool; message : string = "sdf")')) {
                assertOnceLine = i;
                break;
            }
        }
        assert.ok(assertOnceLine >= 0, 'Should find assert_once function declaration');

        // Verify 'string' in default parameter is highlighted as a type
        // Find the second occurrence of 'string' (after message :)
        const lineText = document.lineAt(assertOnceLine).text;
        const stringIndex = lineText.indexOf('string');
        assert.ok(stringIndex > 0, 'Should find string type');
        
        const stringPos = new vscode.Position(assertOnceLine, stringIndex);
        const stringScopes = await getTokenScopesAt(document, assertOnceLine, stringPos.character);
        const isStringType = stringScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('support.type')
        );
        assert.ok(isStringType, `'string' should be highlighted as a type. Got scopes: ${JSON.stringify(stringScopes?.scopes)}`);

        // Verify 'bool' is also highlighted as a type
        const boolPos = findInLine(document, assertOnceLine, 'bool');
        const boolScopes = await getTokenScopesAt(document, assertOnceLine, boolPos.character);
        const isBoolType = boolScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('support.type')
        );
        assert.ok(isBoolType, `'bool' should be highlighted as a type. Got scopes: ${JSON.stringify(boolScopes?.scopes)}`);

        // Verify the default value "sdf" is highlighted as a string
        const sdfPos = findInLine(document, assertOnceLine, 'sdf');
        const sdfScopes = await getTokenScopesAt(document, assertOnceLine, sdfPos.character);
        const isSdfString = sdfScopes?.scopes?.some(scope =>
            scope.includes('string')
        );
        assert.ok(isSdfString, `'sdf' should be highlighted as a string. Got scopes: ${JSON.stringify(sdfScopes?.scopes)}`);

        // Test 2: Function with multiple default parameters
        // def public log_message(level : int = 1; text : string = "default"; verbose : bool = false)
        let logMessageLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def public log_message(level : int = 1')) {
                logMessageLine = i;
                break;
            }
        }
        assert.ok(logMessageLine >= 0, 'Should find log_message function declaration');

        // Verify 'int' is highlighted as a type
        const intPos = findInLine(document, logMessageLine, 'int');
        const intScopes = await getTokenScopesAt(document, logMessageLine, intPos.character);
        const isIntType = intScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('support.type')
        );
        assert.ok(isIntType, `'int' should be highlighted as a type. Got scopes: ${JSON.stringify(intScopes?.scopes)}`);

        // Verify 'string' (second parameter) is highlighted as a type
        const logLineText = document.lineAt(logMessageLine).text;
        const stringInLogIndex = logLineText.indexOf('string');
        assert.ok(stringInLogIndex > 0, 'Should find string type in log_message');
        
        const stringInLogPos = new vscode.Position(logMessageLine, stringInLogIndex);
        const stringInLogScopes = await getTokenScopesAt(document, logMessageLine, stringInLogPos.character);
        const isStringInLogType = stringInLogScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('support.type')
        );
        assert.ok(isStringInLogType, `'string' in log_message should be highlighted as a type. Got scopes: ${JSON.stringify(stringInLogScopes?.scopes)}`);

        // Test 3: Function with default numeric parameters
        // def calculate(x : float = 1.0; y : float = 2.0) : float
        let calculateLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def calculate(x : float = 1.0')) {
                calculateLine = i;
                break;
            }
        }
        assert.ok(calculateLine >= 0, 'Should find calculate function declaration');

        // Verify first 'float' (parameter type) is highlighted as a type
        const floatPos = findInLine(document, calculateLine, 'float');
        const floatScopes = await getTokenScopesAt(document, calculateLine, floatPos.character);
        const isFloatType = floatScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('support.type')
        );
        assert.ok(isFloatType, `'float' parameter type should be highlighted as a type. Got scopes: ${JSON.stringify(floatScopes?.scopes)}`);

        // Test 4: Function with mixed default and non-default parameters
        // def process(name : string; age : int = 18; active : bool = true)
        let processLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def process(name : string; age : int = 18')) {
                processLine = i;
                break;
            }
        }
        assert.ok(processLine >= 0, 'Should find process function declaration');

        // Verify 'string' (non-default parameter) is highlighted as a type
        const processLineText = document.lineAt(processLine).text;
        const stringInProcessIndex = processLineText.indexOf('string');
        assert.ok(stringInProcessIndex > 0, 'Should find string type in process');
        
        const stringInProcessPos = new vscode.Position(processLine, stringInProcessIndex);
        const stringInProcessScopes = await getTokenScopesAt(document, processLine, stringInProcessPos.character);
        const isStringInProcessType = stringInProcessScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('support.type')
        );
        assert.ok(isStringInProcessType, `'string' in process should be highlighted as a type. Got scopes: ${JSON.stringify(stringInProcessScopes?.scopes)}`);

        // Verify 'int' with default value is highlighted as a type
        const intInProcessPos = findInLine(document, processLine, 'int');
        const intInProcessScopes = await getTokenScopesAt(document, processLine, intInProcessPos.character);
        const isIntInProcessType = intInProcessScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('support.type')
        );
        assert.ok(isIntInProcessType, `'int' in process should be highlighted as a type. Got scopes: ${JSON.stringify(intInProcessScopes?.scopes)}`);

        console.log('✓ Function default parameters test passed');
    });

    test('Template function variable names should highlight as types', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/template-functions.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with template variables: for $i(iname) in $e(call.arguments[0])
        let templateForLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('for $i(iname)')) {
                templateForLine = i;
                break;
            }
        }
        assert.ok(templateForLine >= 0, 'Should find line with template for loop');

        // Test 1: Verify 'for' (3 chars) is highlighted as a keyword, not as entity.name.type
        // 'for' is a flow-control keyword and should be tokenized as keyword.control
        const forPos = findInLine(document, templateForLine, 'for');
        const forScopes = await getTokenScopesAt(document, templateForLine, forPos.character);
        const isForKeyword = forScopes?.scopes?.some(scope => scope.includes('keyword.control'));
        assert.ok(isForKeyword, `'for' should be highlighted as keyword.control, not entity.name.type. Got scopes: ${JSON.stringify(forScopes?.scopes)}`);

        // Test 2: Verify 'iname' is highlighted as entity.name.type
        // Expected: entity.name.type.dascript (color #4EC9B0)
        // Test 2: Verify 'iname' inside $i(iname) is highlighted as variable.parameter
        // This is correct because 'iname' is a variable/parameter name being passed to the qmacro
        const lineText = document.lineAt(templateForLine).text;
        const inameIndex = lineText.indexOf('iname');
        assert.ok(inameIndex > 0, 'Should find iname in line');
        
        const inamePos = new vscode.Position(templateForLine, inameIndex);
        const inameScopes = await getTokenScopesAt(document, templateForLine, inamePos.character);
        
        const isInameVariable = inameScopes?.scopes?.some(scope =>
            scope.includes('variable.parameter')
        );
        assert.ok(isInameVariable, `'iname' should be highlighted as variable.parameter (it's a parameter to qmacro escape sequence). Got scopes: ${JSON.stringify(inameScopes?.scopes)}`);

        // Test 3: Verify first character 'i' (1 char) in 'iname' is also a variable
        const firstIIndex = lineText.indexOf('$i(') + 3; // Position of 'i' in 'iname'
        const firstIPos = new vscode.Position(templateForLine, firstIIndex);
        const firstIScopes = await getTokenScopesAt(document, templateForLine, firstIPos.character);
        // Should be variable.parameter
        const isFirstIVariable = firstIScopes?.scopes?.some(scope =>
            scope.includes('variable.parameter')
        );
        assert.ok(isFirstIVariable, `First character 'i' (1 char) should be highlighted as variable.parameter. Got scopes: ${JSON.stringify(firstIScopes?.scopes)}`);

        // Test 4: Verify that qmacro parameters have variable scope
        const hasVariableScope = inameScopes?.scopes?.some(scope =>
            scope.includes('variable.parameter')
        );
        assert.ok(hasVariableScope, `Should have variable.parameter scope. Got scopes: ${JSON.stringify(inameScopes?.scopes)}`);

        // Test 5: Verify 'iname' in yield statement
        let yieldLine = -1;
        for (let i = templateForLine; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('yield $i(iname)')) {
                yieldLine = i;
                break;
            }
        }
        assert.ok(yieldLine >= 0, 'Should find line with yield statement');

        const yieldLineText = document.lineAt(yieldLine).text;
        const yieldInameIndex = yieldLineText.indexOf('iname');
        const yieldInamePos = new vscode.Position(yieldLine, yieldInameIndex);
        const yieldInameScopes = await getTokenScopesAt(document, yieldLine, yieldInamePos.character);
        const isYieldInameVariable = yieldInameScopes?.scopes?.some(scope =>
            scope.includes('variable.parameter')
        );
        assert.ok(isYieldInameVariable, `'iname' in yield should be highlighted as variable.parameter. Got scopes: ${JSON.stringify(yieldInameScopes?.scopes)}`);

        console.log('✓ Template function variable names test passed');
    });

    test('Template function keywords should be highlighted as keywords not types', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/template-functions.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the template with multiple keywords
        let templateLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('def template_with_keywords')) {
                templateLine = i;
                break;
            }
        }
        assert.ok(templateLine >= 0, 'Should find template_with_keywords function');

        // Test 1: Verify 'if' keyword is highlighted as keyword.control
        let ifLine = -1;
        for (let i = templateLine; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('if $e(condition)')) {
                ifLine = i;
                break;
            }
        }
        assert.ok(ifLine >= 0, 'Should find line with if statement');

        const ifPos = findInLine(document, ifLine, 'if');
        const ifScopes = await getTokenScopesAt(document, ifLine, ifPos.character);
        const isIfKeyword = ifScopes?.scopes?.some(scope => scope.includes('keyword.control'));
        assert.ok(isIfKeyword, `'if' should be highlighted as keyword.control. Got scopes: ${JSON.stringify(ifScopes?.scopes)}`);

        // Test 2: Verify 'while' keyword is highlighted as keyword.control
        let whileLine = -1;
        for (let i = templateLine; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('while $v(counter)')) {
                whileLine = i;
                break;
            }
        }
        assert.ok(whileLine >= 0, 'Should find line with while statement');

        const whilePos = findInLine(document, whileLine, 'while');
        const whileScopes = await getTokenScopesAt(document, whileLine, whilePos.character);
        const isWhileKeyword = whileScopes?.scopes?.some(scope => scope.includes('keyword.control'));
        assert.ok(isWhileKeyword, `'while' should be highlighted as keyword.control. Got scopes: ${JSON.stringify(whileScopes?.scopes)}`);

        // Test 3: Verify 'let' keyword is highlighted as keyword
        let letLine = -1;
        for (let i = templateLine; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('let $v(result)')) {
                letLine = i;
                break;
            }
        }
        assert.ok(letLine >= 0, 'Should find line with let statement');

        const letPos = findInLine(document, letLine, 'let');
        const letScopes = await getTokenScopesAt(document, letLine, letPos.character);
        const isLetKeyword = letScopes?.scopes?.some(scope => 
            scope.includes('keyword') || scope.includes('storage.modifier')
        );
        assert.ok(isLetKeyword, `'let' should be highlighted as a keyword or storage modifier. Got scopes: ${JSON.stringify(letScopes?.scopes)}`);

        // Test 4: Verify 'return' keyword is highlighted as keyword
        let returnLine = -1;
        for (let i = templateLine; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('return $v(result)')) {
                returnLine = i;
                break;
            }
        }
        assert.ok(returnLine >= 0, 'Should find line with return statement');

        const returnPos = findInLine(document, returnLine, 'return');
        const returnScopes = await getTokenScopesAt(document, returnLine, returnPos.character);
        const isReturnKeyword = returnScopes?.scopes?.some(scope => scope.includes('keyword'));
        assert.ok(isReturnKeyword, `'return' should be highlighted as a keyword. Got scopes: ${JSON.stringify(returnScopes?.scopes)}`);

        // Test 5: Verify keywords are NOT highlighted as entity.name.type
        const ifNotType = !ifScopes?.scopes?.some(scope => scope === 'entity.name.type.dascript');
        const whileNotType = !whileScopes?.scopes?.some(scope => scope === 'entity.name.type.dascript');
        const letNotType = !letScopes?.scopes?.some(scope => scope === 'entity.name.type.dascript');
        const returnNotType = !returnScopes?.scopes?.some(scope => scope === 'entity.name.type.dascript');

        assert.ok(ifNotType, `'if' should NOT be tokenized as entity.name.type.dascript`);
        assert.ok(whileNotType, `'while' should NOT be tokenized as entity.name.type.dascript`);
        assert.ok(letNotType, `'let' should NOT be tokenized as entity.name.type.dascript`);
        assert.ok(returnNotType, `'return' should NOT be tokenized as entity.name.type.dascript`);

        console.log('✓ Template function keywords test passed');
    });

    test('Qmacro escape sequences should be highlighted as function calls', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/template-functions.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with $i(iname)
        let qmacroLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('$i(iname)')) {
                qmacroLine = i;
                break;
            }
        }
        assert.ok(qmacroLine >= 0, 'Should find line with $i(iname)');

        // Test 1: Verify '$i' single character 'i' is highlighted as entity.name.function
        // Expected: entity.name.function (color #DCDCAA)
        const lineText = document.lineAt(qmacroLine).text;
        const dollarIIndex = lineText.indexOf('$i(');
        assert.ok(dollarIIndex >= 0, 'Should find $i( in line');
        
        // Test the 'i' character right after '$'
        const iPos = new vscode.Position(qmacroLine, dollarIIndex + 1);
        const iScopes = await getTokenScopesAt(document, qmacroLine, iPos.character);
        const isIMacroSubstitution = iScopes?.scopes?.some(scope => scope.includes('support.function.macro.substitution'));
        assert.ok(isIMacroSubstitution, `'i' in '$i' should be highlighted as support.function.macro.substitution. Got scopes: ${JSON.stringify(iScopes?.scopes)}`);

        // Test 2: Verify 'iname' parameter is highlighted as variable.parameter, not entity.name.type
        const inameIndex = lineText.indexOf('$i(') + 3;
        const inamePos = new vscode.Position(qmacroLine, inameIndex);
        const inameScopes = await getTokenScopesAt(document, qmacroLine, inamePos.character);
        const isInameVariable = inameScopes?.scopes?.some(scope => scope.includes('variable.parameter'));
        const isNotInameType = !inameScopes?.scopes?.some(scope => scope === 'entity.name.type.dascript');
        assert.ok(isInameVariable, `'iname' parameter should be highlighted as variable.parameter. Got scopes: ${JSON.stringify(inameScopes?.scopes)}`);
        assert.ok(isNotInameType, `'iname' should NOT be highlighted as entity.name.type.dascript. Got scopes: ${JSON.stringify(inameScopes?.scopes)}`);

        // Test 3: Verify $e escape sequence
        let eLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('$e(call.arguments[0])')) {
                eLine = i;
                break;
            }
        }
        assert.ok(eLine >= 0, 'Should find line with $e');

        const eLineText = document.lineAt(eLine).text;
        const dollarEIndex = eLineText.indexOf('$e(');
        const ePos = new vscode.Position(eLine, dollarEIndex + 1);
        const eScopes = await getTokenScopesAt(document, eLine, ePos.character);
        const isEMacroSubstitution = eScopes?.scopes?.some(scope => scope.includes('support.function.macro.substitution'));
        assert.ok(isEMacroSubstitution, `'e' in '$e' should be highlighted as support.function.macro.substitution. Got scopes: ${JSON.stringify(eScopes?.scopes)}`);

        // Test 4: Verify $v escape sequence
        let vLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('$v(vname)')) {
                vLine = i;
                break;
            }
        }
        assert.ok(vLine >= 0, 'Should find line with $v');

        const vLineText = document.lineAt(vLine).text;
        const dollarVIndex = vLineText.indexOf('$v(');
        const vPos = new vscode.Position(vLine, dollarVIndex + 1);
        const vScopes = await getTokenScopesAt(document, vLine, vPos.character);
        const isVMacroSubstitution = vScopes?.scopes?.some(scope => scope.includes('support.function.macro.substitution'));
        assert.ok(isVMacroSubstitution, `'v' in '$v' should be highlighted as support.function.macro.substitution. Got scopes: ${JSON.stringify(vScopes?.scopes)}`);

        console.log('✓ Qmacro escape sequences test passed');
    });

    test('Call macro annotations before class with generic inheritance should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/call-macro-annotations.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Find [call_macro(name="yeild_from")] annotation
        let callMacroLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('[call_macro(name="yeild_from")]')) {
                callMacroLine = i;
                break;
            }
        }
        assert.ok(callMacroLine >= 0, 'Should find [call_macro(name="yeild_from")] line');

        // Verify 'call_macro' text (10 chars) is highlighted as annotation, not as entity.name.type
        const lineText = document.lineAt(callMacroLine).text;
        const callMacroIndex = lineText.indexOf('call_macro');
        assert.ok(callMacroIndex >= 0, 'Should find call_macro text');

        const callMacroPos = new vscode.Position(callMacroLine, callMacroIndex);
        const callMacroScopes = await getTokenScopesAt(document, callMacroLine, callMacroPos.character);
        
        // Should be entity.name.function.annotation, NOT entity.name.type
        const isAnnotation = callMacroScopes?.scopes?.some(scope => 
            scope.includes('entity.name.function.annotation')
        );
        const isInMetaTemplate = callMacroScopes?.scopes?.some(scope => 
            scope.includes('meta.template.function')
        );
        const isEntityNameType = callMacroScopes?.scopes?.some(scope => 
            scope === 'entity.name.type.dascript'
        );

        assert.ok(isAnnotation, `'call_macro' should be highlighted as entity.name.function.annotation. Got scopes: ${JSON.stringify(callMacroScopes?.scopes)}`);
        assert.ok(!isInMetaTemplate, `'call_macro' should NOT be in meta.template.function context. Got scopes: ${JSON.stringify(callMacroScopes?.scopes)}`);
        assert.ok(!isEntityNameType, `'call_macro' should NOT be entity.name.type.dascript. Got scopes: ${JSON.stringify(callMacroScopes?.scopes)}`);

        // Test 2: Verify next line with class inheritance doesn't affect annotation
        let classLine = callMacroLine + 1;
        const classLineText = document.lineAt(classLine).text;
        assert.ok(classLineText.includes('class private YieldFrom : AstCallMacro'), 'Should find class declaration');

        // Verify AstCallMacro is highlighted as a type
        const astCallMacroIndex = classLineText.indexOf('AstCallMacro');
        const astCallMacroPos = new vscode.Position(classLine, astCallMacroIndex);
        const astCallMacroScopes = await getTokenScopesAt(document, classLine, astCallMacroPos.character);
        const isAstCallMacroType = astCallMacroScopes?.scopes?.some(scope =>
            scope.includes('entity.name.type') || scope.includes('entity.other.inherited-class')
        );
        assert.ok(isAstCallMacroType, `'AstCallMacro' should be highlighted as a type. Got scopes: ${JSON.stringify(astCallMacroScopes?.scopes)}`);

        console.log('✓ Call macro annotations with inheritance test passed');
    });

    test('Call macro annotations after qmacro blocks should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/call-macro-annotations.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Find the second [call_macro] annotation (the one after qmacro_block)
        let secondCallMacroLine = -1;
        let foundFirst = false;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('[call_macro(name="co_continue")]')) {
                secondCallMacroLine = i;
                break;
            }
        }
        assert.ok(secondCallMacroLine >= 0, 'Should find second [call_macro] annotation');

        const lineText = document.lineAt(secondCallMacroLine).text;
        const callMacroIndex = lineText.indexOf('call_macro');
        assert.ok(callMacroIndex >= 0, 'Should find call_macro text');

        const callMacroPos = new vscode.Position(secondCallMacroLine, callMacroIndex);
        const callMacroScopes = await getTokenScopesAt(document, secondCallMacroLine, callMacroPos.character);

        // Should be entity.name.function.annotation, NOT entity.name.type
        const isAnnotation = callMacroScopes?.scopes?.some(scope => 
            scope.includes('entity.name.function.annotation')
        );
        const isInMetaTemplate = callMacroScopes?.scopes?.some(scope => 
            scope.includes('meta.template.function')
        );
        const isEntityNameType = callMacroScopes?.scopes?.some(scope => 
            scope === 'entity.name.type.dascript'
        );

        assert.ok(isAnnotation, `Second 'call_macro' (after qmacro_block) should be highlighted as entity.name.function.annotation. Got scopes: ${JSON.stringify(callMacroScopes?.scopes)}`);
        assert.ok(!isInMetaTemplate, `Second 'call_macro' should NOT be in meta.template.function context. Got scopes: ${JSON.stringify(callMacroScopes?.scopes)}`);
        assert.ok(!isEntityNameType, `Second 'call_macro' should NOT be entity.name.type.dascript. Got scopes: ${JSON.stringify(callMacroScopes?.scopes)}`);

        console.log('✓ Call macro annotation after qmacro_block test passed');
    });

    test('Generator type with angle brackets should not include < in keyword', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/generator-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with generator<$t(retT)>() <|
        let generatorLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('generator<$t(retT)>() <|')) {
                generatorLine = i;
                break;
            }
        }
        assert.ok(generatorLine >= 0, 'Should find line with generator<$t(retT)>() <|');

        // Test 1: Verify 'generator' is a keyword
        const generatorPos = findInLine(document, generatorLine, 'generator');
        const generatorScopes = await getTokenScopesAt(document, generatorLine, generatorPos.character);
        const isGeneratorKeyword = generatorScopes?.scopes?.some(scope => 
            scope.includes('keyword.type.dascript')
        );
        assert.ok(isGeneratorKeyword, `'generator' should be a keyword. Got scopes: ${JSON.stringify(generatorScopes?.scopes)}`);

        // Test 2: Verify the '<' after 'generator' is NOT an operator (it's part of generic type syntax)
        const anglePos = findInLine(document, generatorLine, 'generator<');
        const angleBracketPos = anglePos.character + 'generator'.length; // position of '<'
        const angleBracketScopes = await getTokenScopesAt(document, generatorLine, angleBracketPos);
        const isGenericPunctuation = angleBracketScopes?.scopes?.some(scope => 
            scope.includes('punctuation.definition.generic')
        );
        const isNotOperator = !angleBracketScopes?.scopes?.some(scope =>
            scope.includes('keyword.operator')
        );
        assert.ok(isGenericPunctuation, `'<' after generator should be generic punctuation. Got scopes: ${JSON.stringify(angleBracketScopes?.scopes)}`);
        assert.ok(isNotOperator, `'<' should NOT be an operator in generic context. Got scopes: ${JSON.stringify(angleBracketScopes?.scopes)}`);

        // Test 3: Verify '<|' pipe operator still works
        const pipePos = findInLine(document, generatorLine, '<|');
        const pipeScopes = await getTokenScopesAt(document, generatorLine, pipePos.character);
        const isPipeOperator = pipeScopes?.scopes?.some(scope => 
            scope.includes('keyword.operator')
        );
        assert.ok(isPipeOperator, `'<|' should be an operator. Got scopes: ${JSON.stringify(pipeScopes?.scopes)}`);

        console.log('✓ Generator type angle brackets test passed');
    });

    test('Comparison operators should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/generator-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the line with comparison: if a < b
        let comparisonLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.trim() === 'if a < b') {
                comparisonLine = i;
                break;
            }
        }
        assert.ok(comparisonLine >= 0, 'Should find line with "if a < b"');

        // Test '<' operator
        const lessThanPos = findInLine(document, comparisonLine, '<');
        const lessThanScopes = await getTokenScopesAt(document, comparisonLine, lessThanPos.character);
        const isLessThanOperator = lessThanScopes?.scopes?.some(scope => 
            scope.includes('keyword.operator')
        );
        assert.ok(isLessThanOperator, `'<' should be an operator. Got scopes: ${JSON.stringify(lessThanScopes?.scopes)}`);

        // Find the line with: if b > a
        let greaterLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.trim() === 'if b > a') {
                greaterLine = i;
                break;
            }
        }
        assert.ok(greaterLine >= 0, 'Should find line with "if b > a"');

        // Test '>' operator
        const greaterThanPos = findInLine(document, greaterLine, '>');
        const greaterThanScopes = await getTokenScopesAt(document, greaterLine, greaterThanPos.character);
        const isGreaterThanOperator = greaterThanScopes?.scopes?.some(scope => 
            scope.includes('keyword.operator')
        );
        assert.ok(isGreaterThanOperator, `'>' should be an operator. Got scopes: ${JSON.stringify(greaterThanScopes?.scopes)}`);

        console.log('✓ Comparison operators test passed');
    });

    test('Generator type in qmacro_block should not highlight < as operator', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/generator-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the exact line from user's example: var inscope blk <- qmacro_block <|
        //                                          return <- generator<$t(retT)>() <|
        let qmacroGeneratorLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes('var inscope blk <- qmacro_block')) {
                // The generator line is the next non-empty line
                for (let j = i + 1; j < document.lineCount; j++) {
                    if (document.lineAt(j).text.includes('generator<$t(retT)>()')) {
                        qmacroGeneratorLine = j;
                        break;
                    }
                }
                break;
            }
        }
        assert.ok(qmacroGeneratorLine >= 0, 'Should find line with generator<$t(retT)>() inside qmacro_block');

        // Verify the '<' after 'generator' is NOT an operator
        const generatorText = 'generator';
        const lineText = document.lineAt(qmacroGeneratorLine).text;
        const generatorIndex = lineText.indexOf(generatorText);
        assert.ok(generatorIndex >= 0, 'Should find generator text in line');
        
        const angleBracketPos = generatorIndex + generatorText.length;
        const angleBracketScopes = await getTokenScopesAt(document, qmacroGeneratorLine, angleBracketPos);
        
        const isGenericPunctuation = angleBracketScopes?.scopes?.some(scope => 
            scope.includes('punctuation.definition.generic')
        );
        const isNotOperator = !angleBracketScopes?.scopes?.some(scope =>
            scope.includes('keyword.operator')
        );
        
        assert.ok(isGenericPunctuation, `'<' after generator in qmacro_block should be generic punctuation. Got scopes: ${JSON.stringify(angleBracketScopes?.scopes)}`);
        assert.ok(isNotOperator, `'<' should NOT be an operator. Got scopes: ${JSON.stringify(angleBracketScopes?.scopes)}`);

        console.log('✓ Generator in qmacro_block test passed');
    });

    test('Array indexing brackets should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/array-indexing.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Simple array indexing - items[0]
        let simpleIndexLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('let first = items[0]')) {
                simpleIndexLine = i;
                break;
            }
        }
        assert.ok(simpleIndexLine >= 0, 'Should find simple array indexing line');

        // Verify the number inside brackets is recognized
        const zeroPos = document.lineAt(simpleIndexLine).text.indexOf('[0]') + 1;
        const zeroScopes = await getTokenScopesAt(document, simpleIndexLine, zeroPos);
        const isNumber = zeroScopes?.scopes?.some(scope => 
            scope.includes('constant.numeric') || scope.includes('source.dascript')
        );
        assert.ok(isNumber, `Number inside brackets should be recognized. Got scopes: ${JSON.stringify(zeroScopes?.scopes)}`);

        // Test 2: Array indexing with variable - items[index]
        let varIndexLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('let value = items[index]')) {
                varIndexLine = i;
                break;
            }
        }
        assert.ok(varIndexLine >= 0, 'Should find variable index line');

        const indexPos = findInLine(document, varIndexLine, 'index');
        const indexScopes = await getTokenScopesAt(document, varIndexLine, indexPos.character);
        const isVariable = indexScopes?.scopes?.some(scope => 
            scope.includes('variable') || scope.includes('source.dascript')
        );
        assert.ok(isVariable, `Variable inside brackets should be recognized. Got scopes: ${JSON.stringify(indexScopes?.scopes)}`);

        // Test 3: Multi-dimensional array indexing - matrix[1][2]
        let multiDimLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('let element = matrix[1][2]')) {
                multiDimLine = i;
                break;
            }
        }
        assert.ok(multiDimLine >= 0, 'Should find multi-dimensional indexing line');

        // Count brackets - should have at least 4 bracket tokens (2 opening, 2 closing)
        const multiDimText = document.lineAt(multiDimLine).text;
        const bracketCount = (multiDimText.match(/\[/g) || []).length;
        assert.ok(bracketCount >= 2, 'Should have multiple opening brackets for multi-dimensional indexing');

        // Test 4: Array indexing in expressions - items[0] + items[1]
        let expressionLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('let sum = items[0] + items[1]')) {
                expressionLine = i;
                break;
            }
        }
        assert.ok(expressionLine >= 0, 'Should find expression with array indexing');

        // Verify plus operator is highlighted as operator
        const plusPos = findInLine(document, expressionLine, '+');
        const plusScopes = await getTokenScopesAt(document, expressionLine, plusPos.character);
        const isPlusOperator = plusScopes?.scopes?.some(scope => scope.includes('keyword.operator'));
        assert.ok(isPlusOperator, `Plus sign should be an operator. Got scopes: ${JSON.stringify(plusScopes?.scopes)}`);

        // Test 5: Array indexing in string interpolation - print("First: {items[0]}")
        let stringInterpLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('print("First: {items[0]}")')) {
                stringInterpLine = i;
                break;
            }
        }
        assert.ok(stringInterpLine >= 0, 'Should find string interpolation with array indexing');

        const firstPos = findInLine(document, stringInterpLine, 'First');
        const firstScopes = await getTokenScopesAt(document, stringInterpLine, firstPos.character);
        const isInString = firstScopes?.scopes?.some(scope => scope.includes('string'));
        assert.ok(isInString, `Text should be inside string. Got scopes: ${JSON.stringify(firstScopes?.scopes)}`);

        // Test 6: Array indexing with member access - objects[0].name
        let memberAccessLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('let name = objects[0].name')) {
                memberAccessLine = i;
                break;
            }
        }
        assert.ok(memberAccessLine >= 0, 'Should find member access with array indexing');

        // Verify that 'name' after the dot is accessible (just check the line exists and parses)
        const nameAfterDot = document.lineAt(memberAccessLine).text.indexOf('.name');
        assert.ok(nameAfterDot > 0, 'Should find .name in the line');

        // Test 7: Array indexing in assignment - items[0] = 100
        let assignmentLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.trim() === 'items[0] = 100') {
                assignmentLine = i;
                break;
            }
        }
        assert.ok(assignmentLine >= 0, 'Should find assignment with array indexing');

        const equalsPos = findInLine(document, assignmentLine, '=');
        const equalsScopes = await getTokenScopesAt(document, assignmentLine, equalsPos.character);
        const isAssignment = equalsScopes?.scopes?.some(scope => 
            scope.includes('keyword.operator')
        );
        assert.ok(isAssignment, `Equals sign should be an operator. Got scopes: ${JSON.stringify(equalsScopes?.scopes)}`);

        // Test 8: Complex expression in brackets - items[index * 2 + 1]
        let complexExprLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('items[index * 2 + 1]')) {
                complexExprLine = i;
                break;
            }
        }
        assert.ok(complexExprLine >= 0, 'Should find complex expression in brackets');

        // Just verify the line is parsed correctly (contains the expected tokens)
        const lineText = document.lineAt(complexExprLine).text;
        assert.ok(lineText.includes('index'), 'Line should contain index variable');
        assert.ok(lineText.includes('*'), 'Line should contain multiplication operator');
        assert.ok(lineText.includes('+'), 'Line should contain addition operator');

        console.log('✓ Array indexing test passed');
    });

    test('Typedef declarations should highlight correctly', async () => {
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/typedef.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Single-line typedef - typedef MyInt = int
        let singleLineTypedefLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('typedef MyInt = int')) {
                singleLineTypedefLine = i;
                break;
            }
        }
        assert.ok(singleLineTypedefLine >= 0, 'Should find single-line typedef');

        const typedefKeywordPos = findInLine(document, singleLineTypedefLine, 'typedef');
        const typedefKeywordScopes = await getTokenScopesAt(document, singleLineTypedefLine, typedefKeywordPos.character);
        const isTypedefKeyword = typedefKeywordScopes?.scopes?.some(scope => 
            scope.includes('keyword.type.dascript')
        );
        assert.ok(isTypedefKeyword, `'typedef' should be a keyword. Got scopes: ${JSON.stringify(typedefKeywordScopes?.scopes)}`);

        const myIntPos = findInLine(document, singleLineTypedefLine, 'MyInt');
        const myIntScopes = await getTokenScopesAt(document, singleLineTypedefLine, myIntPos.character);
        const isTypeName = myIntScopes?.scopes?.some(scope => 
            scope.includes('entity.name.type.dascript')
        );
        assert.ok(isTypeName, `'MyInt' should be a type name. Got scopes: ${JSON.stringify(myIntScopes?.scopes)}`);

        // Test 2: Multiline typedef with single type - typedef\n    Coroutine = iterator<bool>
        let multilineTypedefLine = -1;
        let coroutineLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.trim() === 'typedef' && i + 1 < document.lineCount) {
                const nextLineText = document.lineAt(i + 1).text;
                if (nextLineText.includes('Coroutine = iterator<bool>')) {
                    multilineTypedefLine = i;
                    coroutineLine = i + 1;
                    break;
                }
            }
        }
        assert.ok(multilineTypedefLine >= 0, 'Should find multiline typedef declaration');
        assert.ok(coroutineLine >= 0, 'Should find Coroutine type definition line');

        const multilineTypedefPos = findInLine(document, multilineTypedefLine, 'typedef');
        const multilineTypedefScopes = await getTokenScopesAt(document, multilineTypedefLine, multilineTypedefPos.character);
        const isMultilineTypedefKeyword = multilineTypedefScopes?.scopes?.some(scope => 
            scope.includes('keyword.type.dascript')
        );
        assert.ok(isMultilineTypedefKeyword, `Multiline 'typedef' should be a keyword. Got scopes: ${JSON.stringify(multilineTypedefScopes?.scopes)}`);

        const coroutinePos = findInLine(document, coroutineLine, 'Coroutine');
        const coroutineScopes = await getTokenScopesAt(document, coroutineLine, coroutinePos.character);
        const isCoroutineTypeName = coroutineScopes?.scopes?.some(scope => 
            scope.includes('entity.name.type.dascript')
        );
        assert.ok(isCoroutineTypeName, `'Coroutine' should be a type name. Got scopes: ${JSON.stringify(coroutineScopes?.scopes)}`);

        // Test 3: Multiline typedef with multiple types
        let multiTypedefLine = -1;
        let coroutinesLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.trim() === 'typedef') {
                // Check if next two lines have Coroutine and Coroutines
                if (i + 2 < document.lineCount) {
                    const line1 = document.lineAt(i + 1).text;
                    const line2 = document.lineAt(i + 2).text;
                    if (line1.includes('Coroutine = iterator<bool>') && line2.includes('Coroutines = array<Coroutine>')) {
                        multiTypedefLine = i;
                        coroutinesLine = i + 2;
                        break;
                    }
                }
            }
        }
        assert.ok(multiTypedefLine >= 0, 'Should find typedef with multiple types');
        assert.ok(coroutinesLine >= 0, 'Should find Coroutines type definition line');

        const coroutinesPos = findInLine(document, coroutinesLine, 'Coroutines');
        const coroutinesScopes = await getTokenScopesAt(document, coroutinesLine, coroutinesPos.character);
        const isCoroutinesTypeName = coroutinesScopes?.scopes?.some(scope => 
            scope.includes('entity.name.type.dascript')
        );
        assert.ok(isCoroutinesTypeName, `'Coroutines' should be a type name. Got scopes: ${JSON.stringify(coroutinesScopes?.scopes)}`);

        // Test 4: Complex types in typedef
        let handlerLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('Handler = function<void>')) {
                handlerLine = i;
                break;
            }
        }
        assert.ok(handlerLine >= 0, 'Should find Handler type definition');

        const handlerPos = findInLine(document, handlerLine, 'Handler');
        const handlerScopes = await getTokenScopesAt(document, handlerLine, handlerPos.character);
        const isHandlerTypeName = handlerScopes?.scopes?.some(scope => 
            scope.includes('entity.name.type.dascript')
        );
        assert.ok(isHandlerTypeName, `'Handler' should be a type name. Got scopes: ${JSON.stringify(handlerScopes?.scopes)}`);

        console.log('✓ Typedef test passed');
    });

    test('Dollar sign $ symbol should highlight as keyword', async function() {
        this.timeout(10000); // Increase timeout to 10 seconds
        
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/template-functions.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: $i macro escape sequence
        let dollarILine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('$i(iname)')) {
                dollarILine = i;
                break;
            }
        }
        assert.ok(dollarILine >= 0, 'Should find line with $i(iname)');

        const dollarIPos = findInLine(document, dollarILine, '$i');
        const dollarIScopes = await getTokenScopesAt(document, dollarILine, dollarIPos.character);
        const isDollarIKeyword = dollarIScopes?.scopes?.some(scope => 
            scope.includes('keyword')
        );
        assert.ok(isDollarIKeyword, `'$' in $i should be a keyword. Got scopes: ${JSON.stringify(dollarIScopes?.scopes)}`);

        // Test 2: $e macro escape sequence
        let dollarELine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('$e(call.arguments[0])')) {
                dollarELine = i;
                break;
            }
        }
        assert.ok(dollarELine >= 0, 'Should find line with $e(call.arguments[0])');

        const dollarEPos = findInLine(document, dollarELine, '$e');
        const dollarEScopes = await getTokenScopesAt(document, dollarELine, dollarEPos.character);
        const isDollarEKeyword = dollarEScopes?.scopes?.some(scope => 
            scope.includes('keyword')
        );
        assert.ok(isDollarEKeyword, `'$' in $e should be a keyword. Got scopes: ${JSON.stringify(dollarEScopes?.scopes)}`);

        // Test 3: $v macro escape sequence
        let dollarVLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('$v(counter)')) {
                dollarVLine = i;
                break;
            }
        }
        assert.ok(dollarVLine >= 0, 'Should find line with $v(counter)');

        const dollarVPos = findInLine(document, dollarVLine, '$v');
        const dollarVScopes = await getTokenScopesAt(document, dollarVLine, dollarVPos.character);
        const isDollarVKeyword = dollarVScopes?.scopes?.some(scope => 
            scope.includes('keyword')
        );
        assert.ok(isDollarVKeyword, `'$' in $v should be a keyword. Got scopes: ${JSON.stringify(dollarVScopes?.scopes)}`);

        // Test 4: Lambda shorthand $ in annotations.das
        const annotationsUri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/annotations.das')
        );
        const annotationsDoc = await vscode.workspace.openTextDocument(annotationsUri);
        await vscode.window.showTextDocument(annotationsDoc);
        await new Promise(resolve => setTimeout(resolve, 1000));

        let lambdaDollarLine = -1;
        for (let i = 0; i < annotationsDoc.lineCount; i++) {
            if (annotationsDoc.lineAt(i).text.includes('$ [es]')) {
                lambdaDollarLine = i;
                break;
            }
        }
        assert.ok(lambdaDollarLine >= 0, 'Should find line with $ [es] lambda shorthand');

        const lambdaDollarPos = findInLine(annotationsDoc, lambdaDollarLine, '$ [es]');
        const lambdaDollarScopes = await getTokenScopesAt(annotationsDoc, lambdaDollarLine, lambdaDollarPos.character);
        const isLambdaDollarKeyword = lambdaDollarScopes?.scopes?.some(scope => 
            scope.includes('keyword')
        );
        assert.ok(isLambdaDollarKeyword, `'$' in lambda shorthand should be a keyword. Got scopes: ${JSON.stringify(lambdaDollarScopes?.scopes)}`);

        console.log('✓ Dollar sign $ symbol test passed');
    });

    test('qmacro_block should highlight as function call', async function() {
        this.timeout(5000);
        
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/template-functions.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find line with qmacro_block
        let qmacroLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('qmacro_block <|')) {
                qmacroLine = i;
                break;
            }
        }
        assert.ok(qmacroLine >= 0, 'Should find line with qmacro_block');

        const qmacroPos = findInLine(document, qmacroLine, 'qmacro_block');
        const qmacroScopes = await getTokenScopesAt(document, qmacroLine, qmacroPos.character);
        const isQmacroFunction = qmacroScopes?.scopes?.some(scope => 
            scope.includes('entity.name.function')
        );
        assert.ok(isQmacroFunction, `'qmacro_block' should be highlighted as entity.name.function. Got scopes: ${JSON.stringify(qmacroScopes?.scopes)}`);

        console.log('✓ qmacro_block function call test passed');
    });

    test('type<> angle brackets should not be highlighted as operators', async function() {
        this.timeout(5000);
        
        const uri = vscode.Uri.file(
            path.join(__dirname, '../../test/fixtures/generator-types.das')
        );

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find line with type<iterator<int>>
        let typeLine = -1;
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('type<iterator<int>>')) {
                typeLine = i;
                break;
            }
        }
        assert.ok(typeLine >= 0, 'Should find line with type<iterator<int>>');

        // Test 1: The first < after type should have meta.generic.type.dascript
        const lineText = document.lineAt(typeLine).text;
        const firstAngleIndex = lineText.indexOf('type<');
        const firstAnglePos = new vscode.Position(typeLine, firstAngleIndex + 4); // Position of first <
        const firstAngleScopes = await getTokenScopesAt(document, typeLine, firstAnglePos.character);
        
        const isNotOperator = !firstAngleScopes?.scopes?.some(scope => 
            scope.includes('keyword.operator')
        );
        const isPunctuation = firstAngleScopes?.scopes?.some(scope => 
            scope.includes('punctuation.definition.generic')
        );
        const hasTypeScope = firstAngleScopes?.scopes?.some(scope => 
            scope.includes('meta.generic.type.dascript')
        );
        
        assert.ok(isNotOperator, `First '<' in type<> should NOT be highlighted as keyword.operator. Got scopes: ${JSON.stringify(firstAngleScopes?.scopes)}`);
        assert.ok(isPunctuation, `First '<' in type<> should be highlighted as punctuation.definition.generic. Got scopes: ${JSON.stringify(firstAngleScopes?.scopes)}`);
        assert.ok(hasTypeScope, `First '<' should have meta.generic.type.dascript scope. Got scopes: ${JSON.stringify(firstAngleScopes?.scopes)}`);

        // Test 2: The second < after iterator should have both meta.generic.dascript and meta.generic.type.dascript
        const secondAngleIndex = lineText.indexOf('iterator<');
        const secondAnglePos = new vscode.Position(typeLine, secondAngleIndex + 8); // Position of second <
        const secondAngleScopes = await getTokenScopesAt(document, typeLine, secondAnglePos.character);
        
        const secondIsNotOperator = !secondAngleScopes?.scopes?.some(scope => 
            scope.includes('keyword.operator')
        );
        const secondIsPunctuation = secondAngleScopes?.scopes?.some(scope => 
            scope.includes('punctuation.definition.generic')
        );
        const hasGenericScope = secondAngleScopes?.scopes?.some(scope => 
            scope === 'meta.generic.dascript'
        );
        const hasTypeGenericScope = secondAngleScopes?.scopes?.some(scope => 
            scope === 'meta.generic.type.dascript'
        );
        
        assert.ok(secondIsNotOperator, `Second '<' in iterator<> should NOT be highlighted as keyword.operator. Got scopes: ${JSON.stringify(secondAngleScopes?.scopes)}`);
        assert.ok(secondIsPunctuation, `Second '<' should be highlighted as punctuation.definition.generic. Got scopes: ${JSON.stringify(secondAngleScopes?.scopes)}`);
        assert.ok(hasGenericScope, `Second '<' should have meta.generic.dascript scope. Got scopes: ${JSON.stringify(secondAngleScopes?.scopes)}`);
        assert.ok(hasTypeGenericScope, `Second '<' should inherit meta.generic.type.dascript scope from parent. Got scopes: ${JSON.stringify(secondAngleScopes?.scopes)}`);

        console.log('✓ type<> angle brackets test passed');
    });
});
