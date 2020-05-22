import { Type, IStr } from "deep-assoc-lang-server/src/structures/Type";
import { IPsi } from "deep-assoc-lang-server/src/helpers/Psi";
import CheapTypeResolver from "deep-assoc-lang-server/src/resolvers/CheapTypeResolver";
import Log from "deep-assoc-lang-server/src/Log";

export const flattenTypes = (multiType: Type): Type[] => {
    if (multiType.kind === 'IMt') {
        return multiType.types.flatMap(flattenTypes);
    } else {
        return [multiType];
    }
};

export const getKey = (arrt: Type, keyType: Type): Type[] => {
    const keyNameOpt = keyType.kind === 'IStr' ? [keyType.content] : [];
    return flattenTypes(arrt).flatMap(arrt => {
        const valueTypes: Type[] = [];
        if (keyNameOpt.length) {
            const keyName = keyNameOpt[0];
            const entries = arrt.kind === 'IRecordArr' ? arrt.entries : [];
            valueTypes.push(
                ...entries.filter(e =>
                    e.keyType.kind === 'IStr' &&
                    e.keyType.content === keyName
                ).map(e => e.valueType)
            );
        } else if (arrt.kind === 'ITupleArr') {
            const indexOpt = keyType.kind === 'IInt' ? [keyType.value] : [];
            if (indexOpt.length) {
                const index = indexOpt[0];
                if (index >= 0 && index < arrt.elements.length) {
                    valueTypes.push(arrt.elements[index]);
                }
            } else {
                valueTypes.push(...arrt.elements);
            }
        } else if (arrt.kind === 'IListArr') {
            // variable, number or math expression used as a key
            valueTypes.push(arrt.valueType);
        }
        if (arrt.kind === 'IMapArr') {
            valueTypes.push(arrt.valueType);
        }
        return valueTypes;
    });
};

export const getKeyByPsi = (arrt: Type, keyExpr: IPsi): Type[] => {
    const keyType = CheapTypeResolver({exprPsi: keyExpr})
        [0] || {kind: 'IAny'};
    return getKey(arrt, keyType);
};