import { Type } from "../structures/Type";
import { IPsi, Opt } from "../helpers/Psi";
import { PhraseType, TokenType } from "php7parser";
import { IApiCtx } from "../contexts/ApiCtx";
import Log from "../Log";
import ArgRes from "./ArgRes";
import { getKey } from "deep-assoc-lang-server/src/helpers/Typing";
import { findVarRefs, isExpr } from "deep-assoc-lang-server/src/helpers/ScopePsiFinder";

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
            .flatMap(leaf => [
                ...leaf.parent()
                    .filter(par => par.node.phraseType === PhraseType.SimpleVariable)
                    .flatMap(leaf => leaf.parent()
                        .filter(par => par.node.phraseType === PhraseType.SimpleAssignmentExpression)
                        .filter(ass => ass.nthChild(0).some(leaf.eq))
                    )
                    .flatMap(ass => ass.children().slice(1).filter(isExpr))
                    .flatMap(apiCtx.resolveExpr),
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