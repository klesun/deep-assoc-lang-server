import { Type } from "../structures/Type";
import Psi, { IPsi, Opt } from "../helpers/Psi";
import { PhraseType, TokenType, Token } from "php7parser";
import { IApiCtx } from "../contexts/ApiCtx";
import Log from "../Log";
import ArgRes from "./ArgRes";
import { getKey } from "deep-assoc-lang-server/src/helpers/Typing";
import { findVarRefs, isExpr } from "deep-assoc-lang-server/src/helpers/ScopePsiFinder";
import CheapTypeResolver from "deep-assoc-lang-server/src/resolvers/CheapTypeResolver";

const parseAsAssignment = (varLeaf: Psi<Token>): Array<{
    keyChain: (Type | {kind: 'IncrIdx'})[],
    assignedValue: IPsi,
}> => {
    const keyChain: Type[] = [];
    let dstPsi = varLeaf.parent()
        .filter(par => par.node.phraseType === PhraseType.SimpleVariable)[0];
    if (!dstPsi) {
        return [];
    }
    let sub;
    while (sub = dstPsi.parent().flatMap(p => p.asPhrase(PhraseType.SubscriptExpression))[0]) {
        const braces = sub.children().slice(1);
        const openPos = braces.findIndex(b => b.asToken(TokenType.OpenBracket));
        const openPosOpt = openPos > -1 ? [openPos] : [];
        const keyType: Type = openPosOpt
            .flatMap(pos => braces.slice(openPos + 1))
            .filter(psi => !psi.asToken(TokenType.Whitespace).length)
            .flatMap(exprPsi => CheapTypeResolver({exprPsi}))
            [0] || (
                sub.text().match(/\[\s*\]$/)
                    ? {kind: 'IncrIdx'} : {kind: 'IAny'}
            );
        keyChain.push(keyType);
        dstPsi = sub;
    }
    return dstPsi.parent()
        .filter(par => par.node.phraseType === PhraseType.SimpleAssignmentExpression)
        .filter(ass => ass.nthChild(0).some(dstPsi.eq))
        .flatMap(ass => ass.children().slice(1).filter(isExpr))
        .map(assignedValue => ({keyChain, assignedValue}));
};

const VarRes = ({exprPsi, apiCtx}: {
    exprPsi: IPsi, apiCtx: IApiCtx,
}): Type[] => {
    const resolveVarRef = (exprPsi: IPsi) => {
        return exprPsi.asPhrase(PhraseType.SimpleVariable)
            .flatMap(psi => psi.asPhrase(PhraseType.SimpleVariable))
            .flatMap(varExpr => {
                const mainDeclOpt = varExpr.reference.flatMap(apiCtx.decl);
                const refs = [
                    ...mainDeclOpt,
                    ...findVarRefs(varExpr)
                        .filter(psi => !mainDeclOpt.length // filter out dupes
                                    || !psi.eq(mainDeclOpt[0])),
                ];
                return refs;
            })
            .flatMap(psi => psi.asToken())
            .flatMap(leaf => [
                ...parseAsAssignment(leaf)
                    .flatMap(({keyChain, assignedValue}) => {
                        return apiCtx.resolveExpr(assignedValue)
                            .map(valueType => {
                                for (let i = keyChain.length - 1; i >= 0; --i) {
                                    const keyType = keyChain[i];
                                    valueType = keyType.kind === 'IncrIdx'
                                        ? {kind: 'IListArr', valueType}
                                        : {kind: 'IMapArr', keyType, valueType};
                                }
                                return valueType;
                            });
                    }),
                ...leaf.parent()
                    .filter(par => par.node.phraseType === PhraseType.SimpleVariable)
                    .flatMap(leaf => leaf.parent())
                    .filter(par => par.node.phraseType === PhraseType.ForeachValue)
                    .flatMap(leaf => leaf.parent())
                    .filter(par => par.node.phraseType === PhraseType.ForeachStatement)
                    .flatMap(fch => fch.children().flatMap(ch => ch.asPhrase(PhraseType.ForeachCollection)))
                    .flatMap(col => col.nthChild(0))
                    .flatMap(apiCtx.resolveExpr)
                    .flatMap(arrt => getKey(arrt, {kind: 'IAny'})),
                ...leaf.parent()
                    .flatMap(psi => ArgRes({psi, apiCtx})),
            ]);
    };

    return resolveVarRef(exprPsi);
};

export default VarRes;