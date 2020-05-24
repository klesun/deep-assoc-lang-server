import Psi, { Opt, IPsi } from "deep-assoc-lang-server/src/helpers/Psi";
import { Phrase, PhraseType, TokenType } from "php7parser";
import { Type } from "deep-assoc-lang-server/src/structures/Type";
import PsalmTypeExprParser from "deep-assoc-lang-server/src/structures/psalm/PsalmTypeExprParser";
import Log from "deep-assoc-lang-server/src/Log";
import { CodeActionKind } from "vscode";

/** removes stars */
const getDocCommentText = (docCommentToken: string): Opt<string> => {
    const match = docCommentToken.match(/^\/\*\**(?:\s*)(.*)\*\/$/s);
    if (!match) {
        return [];
    } else {
        const clean = match[1].split('\n')
            .map(l => l.replace(/^\s*\*\s?/, ''))
            .join('\n');
        return [clean];
    }
};

interface RawDocTag {
    tagName: string;
    textLeft: string;
}

const getRawTags = (docText: string) => {
    const tags = [];
    let current: Opt<RawDocTag> = [];
    for (const line of docText.split('\n')) {
        const match = line.match(/^\s*@([\w\-]+)\s*(.*)/);
        if (match) {
            const [, tagName, textLeft] = match;
            tags.push(...current);
            current = [{tagName, textLeft}];
        } else if (current.length) {
            current = [{
                tagName: current[0].tagName,
                textLeft: current[0].textLeft + '\n' + line,
            }];
        }
    }
    tags.push(...current);
    return tags;
};

const collectTypeAliases = (funcDeclPsi: IPsi): Record<string, Type> => {
    const nameToType: Record<string, Type> = {};
    const aliases = funcDeclPsi.parents().slice(-1)
        .filter(root => root.node.phraseType === PhraseType.StatementList)
        .flatMap(root => root.children())
        .flatMap(chd => chd.asToken(TokenType.DocumentComment))
        .flatMap(psi => getDocCommentText(psi.text()))
        .flatMap(getRawTags)
        .filter(docTag => docTag.tagName === 'psalm-type')
        .flatMap(docTag => {
            const match = docTag.textLeft.match(/^\s*(\w+)\s*=(.*)/s);
            if (!match) {
                return [];
            }
            const [, name, typeStr] = match;
            return PsalmTypeExprParser(typeStr)
                .map(parsed => ({
                    name: name,
                    type: parsed.type,
                    textLeft: parsed.textLeft,
                }));
        });
    for (const {name, type} of aliases) {
        nameToType[name] = type;
    }
    return nameToType;
};

const getMethDoc = (funcDeclPsi: Psi<Phrase>) => {
    let prevPsi: IPsi[] = funcDeclPsi.prevSibling(psi => !psi.asToken(TokenType.Whitespace).length);
    if (!prevPsi.length) {
        prevPsi = funcDeclPsi.parent()
            .filter(par => par.node.phraseType === PhraseType.ClassMemberDeclarationList)
            .flatMap(declList => declList.prevSibling(psi => !psi.asToken(TokenType.Whitespace).length));
    }
    return prevPsi.flatMap(par => par.asToken(TokenType.DocumentComment));
};

/**
 * note, returned types may be an IMt instance,
 * so you better call flattenTypes() right afterwards
 *
 * did not want putting flattening here, because there could
 * probably be other kinds of complex types than A|B, like A&B
 */
const PsalmFuncInfo = ({funcDeclPsi}: {
    funcDeclPsi: Psi<Phrase>,
}): Opt<{
    params: Record<string, Type>,
    returnType: Opt<Type>,
}> => {
    // TODO: cache per file eventually
    const nameToType = collectTypeAliases(funcDeclPsi);

    /** add type info from local and imported aliases */
    const addContext = (type: Type): Type => {
        const nameOccurences = new Set();
        const addContext = (type: Type): Type => {
            if (type.kind === 'IFqn' && !type.fqn.includes('\\')) {
                const aliasType = nameToType[type.fqn] || null;
                if (!aliasType) {
                    return type;
                } else if (nameOccurences.has(type.fqn)) {
                    // circular reference - don't add context further
                    return aliasType;
                } else {
                    nameOccurences.add(type.fqn);
                    const withContext = addContext(aliasType);
                    nameOccurences.delete(type.fqn);
                    return withContext;
                }
            } else if (type.kind === 'IListArr') {
                return {kind: 'IListArr',
                    valueType: addContext(type.valueType),
                };
            } else if (type.kind === 'IMapArr') {
                return {kind: 'IMapArr',
                    keyType: addContext(type.keyType),
                    valueType: addContext(type.valueType),
                };
            } else if (type.kind === 'IRecordArr') {
                return {kind: 'IRecordArr',
                    entries: type.entries.map(e => ({
                        keyType: addContext(e.keyType),
                        valueType: addContext(e.valueType),
                    })),
                };
            } else if (type.kind === 'IMt') {
                return {kind: 'IMt',
                    types: type.types.map(addContext),
                };
            } else if (type.kind === 'ITupleArr') {
                return {kind: 'ITupleArr',
                    elements: type.elements.map(addContext),
                };
            } else {
                return type;
            }
        };
        return addContext(type);
    };

    if (![PhraseType.FunctionDeclaration, PhraseType.MethodDeclaration].includes(funcDeclPsi.node.phraseType)) {
        return [];
    }
    const typedTags = getMethDoc(funcDeclPsi)
        .flatMap(psi => getDocCommentText(psi.text()))
        .flatMap(getRawTags)
        .flatMap(rawTag => PsalmTypeExprParser(rawTag.textLeft)
            .map(parsed => ({
                tagName: rawTag.tagName,
                type: addContext(parsed.type),
                textLeft: parsed.textLeft,
            })));

    const params: Record<string, Type> = {};
    let returnType: Opt<Type> = [];
    for (const typedTag of typedTags) {
        if (['param', 'psalm-param'].includes(typedTag.tagName)) {
            const tagArgName = typedTag.textLeft.trim()
                .replace(/^\$(\w+).*/s, '$1');
            params[tagArgName] = typedTag.type;
        } else if (['return', 'psalm-return'].includes(typedTag.tagName)) {
            returnType = [typedTag.type];
        }
    }

    return [{params, returnType}];
};

export default PsalmFuncInfo;