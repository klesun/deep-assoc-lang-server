import Psi, { IPsi } from "deep-assoc-lang-server/src/helpers/Psi";
import { IApiCtx } from "deep-assoc-lang-server/src/contexts/ApiCtx";
import { CompletionItem } from "vscode-languageserver";
import Log from "deep-assoc-lang-server/src/Log";
import { TokenType, PhraseType, Phrase } from "php7parser";
import { assertFuncRef } from "deep-assoc-lang-server/src/resolvers/FuncCallRes";
import { Type } from "deep-assoc-lang-server/src/structures/Type";
import { makeArrKeyCompletionItems } from "deep-assoc-lang-server/src/helpers/UiAdapter";
import ArgRes from "deep-assoc-lang-server/src/resolvers/ArgRes";

/** provides completion options in `doStuff(['<>' => 123])` */
const ArrCtorKeyPvdr = ({psi, apiCtx}: {
    apiCtx: IApiCtx, psi: IPsi,
}): CompletionItem[] => {

    const getArrCtor = (psi: IPsi) => {
        const leaf = psi.asToken()[0];
        if (!leaf) {
            return [];
        }
        if (leaf.node.tokenType === TokenType.StringLiteral) {
            return leaf.parent()
                .flatMap(par => par.asPhrase(PhraseType.ArrayKey, PhraseType.ArrayValue))
                .flatMap(lit => lit.parent())
                .flatMap(par => par.asPhrase(PhraseType.ArrayElement))
                .flatMap(lit => lit.parent())
                .flatMap(par => par.asPhrase(PhraseType.ArrayInitialiserList))
                .flatMap(lit => lit.parent())
                .flatMap(par => par.asPhrase(PhraseType.ArrayCreationExpression));
        } else if (['\'', '"', '\'\'', '""'].includes(leaf.text().trim())) {
            // when user only starts typing an associative
            // array and there is not even `=>` afterwards
            // depending on whitespace, may either point
            // to the closing bracket or to whitespace
            return leaf.parent()
                .flatMap(par => par.asPhrase(PhraseType.ArrayCreationExpression));
        } else {
            return [];
        }
    };

    const resolveArrCtor = (arrCtor: Psi<Phrase>): Type[] => {
        return arrCtor.parent()
            .flatMap(par => par.asPhrase(PhraseType.ArgumentExpressionList))
            .flatMap(lst => {
                const argOrder = lst.children().findIndex(c => c.node === arrCtor.node);
                return lst.parent()
                    .flatMap(assertFuncRef)
                    .flatMap(apiCtx.decl)
                    .flatMap(decl => decl.asToken(TokenType.CloseBrace))
                    .flatMap(bracePsi => bracePsi.parent())
                    .flatMap(par => par.asPhrase(
                        PhraseType.FunctionDeclarationBody,
                        PhraseType.CompoundStatement,
                    ))
                    .flatMap(par => par.prevSibling(psi => !psi.asToken(TokenType.Whitespace).length))
                    .flatMap(par => par.asPhrase(PhraseType.FunctionDeclarationHeader))
                    .flatMap(hdr => hdr.children().flatMap(psi => psi.asPhrase(PhraseType.ParameterDeclarationList)))
                    .flatMap(lst => lst.nthChild(argOrder))
                    .flatMap(psi => ArgRes({psi, apiCtx}));
            });
    };

    const getCompletions = (psi: IPsi): CompletionItem[] => {
        return getArrCtor(psi)
            .flatMap(resolveArrCtor)
            .flatMap(makeArrKeyCompletionItems);
    };

    return getCompletions(psi);
};

export default ArrCtorKeyPvdr;