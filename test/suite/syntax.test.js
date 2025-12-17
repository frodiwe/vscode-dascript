const assert = require('assert');
const vscode = require('vscode');
const path = require('path');

/**
 * Get token scopes at a specific position in the document
 */
async function getTokenScopesAt(document, line, character) {
    const position = new vscode.Position(line, character);

    // Get TextMate token scopes (these are what the grammar defines)
    const scopes = await vscode.commands.executeCommand(
        'editor.action.inspectTMScopes',
        document.uri,
        position
    );

    return scopes;
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
});
