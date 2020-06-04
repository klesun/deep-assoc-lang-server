import { PhraseType, Phrase, TokenType, Token } from "php7parser";
import Psi, { IPsi } from "deep-assoc-lang-server/src/helpers/Psi";
import Log from "deep-assoc-lang-server/src/Log";

/**
 * @module - a collection of functions that traverse a part of code to find
 *  some particular elements, like returns or references of a variable.
 *
 *  Currently it always happen in realtime, but I'd like to
 *  eventually have some caching per PSI or something implemented
 */

const findFunctionScopePsis = (funcBody: Psi<Phrase>, pred: (subPsi: Psi<Phrase>) => boolean): Psi<Phrase>[] => {
    const findDeeper = (stPsi: Psi<Phrase>): Psi<Phrase>[] => {
        if (stPsi.node.phraseType === PhraseType.FunctionDeclarationBody ||
            stPsi.node.phraseType === PhraseType.ClassMemberDeclarationList
        ) {
            // skip anonymous functions, they have their own scope
            return [];
        } else if (pred(stPsi)) {
            return [stPsi];
        } else {
            return stPsi.children()
                .flatMap(c => c.asPhrase())
                .flatMap(findDeeper);
        }
    };
    return funcBody.children()
        .flatMap(ch => ch.asPhrase())
        .flatMap(findDeeper);
};

export const findFunctionReturns = (funcBody: Psi<Phrase>): Psi<Phrase>[] => {
    return findFunctionScopePsis(funcBody, subPsi => {
        return subPsi.node.phraseType === PhraseType.ReturnStatement
    });
};

const findVarsByName = (scopeBody: Psi<Phrase>, varTokenText: string): Psi<Phrase>[] => {
    return findFunctionScopePsis(scopeBody, subPsi => {
        return subPsi.node.phraseType === PhraseType.SimpleVariable
            && subPsi.text() === varTokenText;
    });
};

const isFuncBody = (psi: Psi<Phrase>) => {
    return psi.node.phraseType === PhraseType.FunctionDeclarationBody
        || psi.node.phraseType === PhraseType.MethodDeclarationBody;
};

export const findVarRefs = (varExpr: Psi<Phrase>): Psi<Token>[] => {
    const varTokenText = varExpr.children()
        .map(leaf => leaf.text().replace(/^$/, ''))[0];
    if (!varTokenText) {
        return [];
    }
    const parents = varExpr.parents();
    const scopeBody =
        parents.filter(isFuncBody)[0] ||
        parents.slice(-1)[0];

    return findVarsByName(scopeBody, varTokenText)
        // exclude caret var from results
        .filter(ref => !ref.eq(varExpr))
        .flatMap(ph => ph.children())
        .flatMap(ch => ch.asToken(TokenType.VariableName));
};

/** a lazy implementation for now - to just filter out spaces and operators */
export const isExpr = (psi: IPsi) => {
    return psi.asPhrase().length
        || psi.asToken().some(leaf => [
            TokenType.StringLiteral,
            TokenType.IntegerLiteral,
            TokenType.FloatingLiteral,
            TokenType.FileConstant,
            TokenType.LineConstant,
            TokenType.DirectoryConstant,
            TokenType.NamespaceConstant,
        ].includes(leaf.node.tokenType));
};