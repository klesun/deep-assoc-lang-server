import { IPsi, Opt } from "../helpers/Psi";
import { IApiCtx } from "../contexts/ApiCtx";
import { Type } from "../structures/Type";
import { PhraseType, TokenType } from "php7parser";
import Log from "deep-assoc-lang-server/src/Log";
import PsalmFuncInfo from "deep-assoc-lang-server/src/structures/psalm/PsalmFuncInfo";
import { flattenTypes } from "deep-assoc-lang-server/src/helpers/Typing";

const ArgRes = ({psi, apiCtx}: {
    psi: IPsi, apiCtx: IApiCtx,
}): Type[] => {
    const resolveArg = (psi: IPsi) => {
        const argName = psi.children()
            .flatMap(psi => psi.asToken(TokenType.VariableName))
            .map(psi => psi.text().slice(1))[0] || null;
        if (!argName) {
            return [];
        }

        return psi.asPhrase(PhraseType.ParameterDeclaration)
            .flatMap(psi => psi.parent())
            .filter(par => par.node.phraseType === PhraseType.ParameterDeclarationList)
            .flatMap(psi => psi.parent())
            .filter(par => [PhraseType.FunctionDeclarationHeader, PhraseType.MethodDeclarationHeader].includes(par.node.phraseType))
            .flatMap(psi => psi.parent())
            .flatMap(funcDeclPsi => PsalmFuncInfo({funcDeclPsi, apiCtx}))
            .flatMap(funcInfo => {
                const argType = funcInfo.params[argName] || null;
                return !argType ? [] : [argType];
            })
            .flatMap(flattenTypes);
    };

    return resolveArg(psi);
};

export default ArgRes;