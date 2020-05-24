import { PhraseType, TokenType, Phrase } from "php7parser";
import Psi, { IPsi } from "../helpers/Psi";
import { Reference } from "intelephense/lib/reference";
import { IApiCtx } from "../contexts/ApiCtx";
import { Type } from "../structures/Type";
import Log from "deep-assoc-lang-server/src/Log";
import PsalmFuncInfo from "deep-assoc-lang-server/src/structures/psalm/PsalmFuncInfo";
import { flattenTypes } from "deep-assoc-lang-server/src/helpers/Typing";

const findFunctionReturns = (stPsi: Psi<Phrase>): Psi<Phrase>[] => {
    if (stPsi.node.phraseType === PhraseType.FunctionDeclarationBody) {
        // skip anonymous functions, they have their own scope
        return [];
    } else if (stPsi.node.phraseType === PhraseType.ReturnStatement) {
        return [stPsi];
    } else {
        return stPsi.children()
            .flatMap(c => c.asPhrase())
            .flatMap(findFunctionReturns);
    }
};

export const assertFuncRef = (exprPsi: IPsi): Reference[] => {
    return [
        ...exprPsi.asPhrase(PhraseType.FunctionCallExpression)
            .flatMap(psi => psi.reference),
        ...exprPsi.asPhrase(PhraseType.MethodCallExpression)
            .flatMap(psi => psi.children())
            .flatMap(psi => psi.asPhrase(PhraseType.MemberName))
            .flatMap(psi => psi.reference),
        ...exprPsi.asPhrase(PhraseType.ScopedCallExpression)
            .flatMap(psi => psi.children())
            .flatMap(psi => psi.asPhrase(PhraseType.ScopedMemberName))
            .flatMap(psi => psi.reference),
    ];
};

const FuncCallRes = ({exprPsi, apiCtx}: {
    exprPsi: IPsi, apiCtx: IApiCtx,
}) => {
    const resolveFromDoc = (braceOwner: Psi<Phrase>): Type[] => {
        return braceOwner.parent()
            .flatMap(par => par.node.phraseType === PhraseType.MethodDeclarationBody ? par.parent() : [par])
            .flatMap(funcDeclPsi => PsalmFuncInfo({funcDeclPsi}))
            .flatMap(funcInfo => funcInfo.returnType)
            .flatMap(flattenTypes);
    };

    const resolveFromReturns = (braceOwner: Psi<Phrase>): Type[] => {
        return braceOwner.asPhrase(
            PhraseType.FunctionDeclarationBody,
            PhraseType.CompoundStatement,
        )   .flatMap(funcBody => funcBody.children())
            .flatMap(psi => psi.asPhrase(PhraseType.StatementList))
            .flatMap(stList => stList.children().flatMap(psi => psi.asPhrase()))
            .flatMap(findFunctionReturns)
            .flatMap(retPsi => retPsi.children().slice(1).flatMap(psi => psi.asPhrase()))
            .flatMap(apiCtx.resolveExpr)
    };

    const resolveAsFuncCall = (exprPsi: IPsi): Type[] =>
        assertFuncRef(exprPsi)
            .flatMap(apiCtx.decl)
            .flatMap(decl => decl.asToken(TokenType.CloseBrace))
            .flatMap(bracePsi => bracePsi.parent())
            .flatMap(braceOwner => {
                return [
                    ...resolveFromDoc(braceOwner),
                    ...resolveFromReturns(braceOwner),
                ];
            });

    return resolveAsFuncCall(exprPsi);
};

export default FuncCallRes;