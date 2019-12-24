/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import { Protocol as Crdp } from 'devtools-protocol';

import * as Variables from '../../src/chrome/variables';

suite('Variables', () => {
    function getPropType(prop: any): 'string'|'number'|'object' {
        return typeof prop === 'string' ? 'string' :
            typeof prop === 'number' ? 'number' :
            'object';
    }

    function getPropValue(prop: any): string {
        if (typeof prop === 'object') {
            return typeof prop.length !== 'undefined' ? `Array[${prop.length}]` :
                'Object';
        } else {
            return prop.toString();
        }
    }

    suite('getArrayPreview()', () => {
        function getRemoteArray(props: any[]): Crdp.Runtime.RemoteObject {
            const preview = <Crdp.Runtime.ObjectPreview>{
                properties: props.map((prop, i) => {
                    return <Crdp.Runtime.PropertyPreview>{
                        name: i.toString(),
                        type: getPropType(prop),
                        value: getPropValue(prop)
                    };
                })
            };

            return {
                type: 'object',
                subtype: 'array',
                description: `Array[${props.length}]`,
                preview
            };
        }

        function testArrayPreview(arr: any[], expected: string): void {
            assert.equal(Variables.getRemoteObjectPreview(getRemoteArray(arr)), expected);
        }

        test('empty array', () => {
            testArrayPreview([], 'Array[0] []');
        });

        test('one-item array', () => {
            testArrayPreview(['hi'], 'Array[1] ["hi"]');
        });

        test('short array', () => {
            testArrayPreview([1, 2, 3], 'Array[3] [1, 2, 3]');
        });

        test('too long array', () => {
            testArrayPreview([1, 2, 3, 4], 'Array[4] [1, 2, 3, …]');
        });

        test('complex array', () => {
            testArrayPreview([1, [5, 6], { a: 1 }], 'Array[3] [1, Array[2], Object]');
        });

        test('long value array', () => {
            const oneHundredAs = 'a'.repeat(100);
            const fiftyAs = 'a'.repeat(50);
            testArrayPreview([oneHundredAs], `Array[1] ["${fiftyAs}…"]`);
        });

        test('gaps in array', () => {
            /* tslint:disable:no-sparse-arrays */
            testArrayPreview([1, , 2, 3], `Array[4] [1, …, 2, 3]`);
            testArrayPreview([, , 2, 3, , 4], `Array[6] […, 2, 3, …, 4]`);
            /* tslint:enable:no-sparse-arrays */
        });
    });

    suite('getObjectPreview()', () => {
        function getRemoteObject(obj: any): Crdp.Runtime.RemoteObject {
            const preview = <Crdp.Runtime.ObjectPreview>{
                properties: Object.keys(obj).map((prop) => {
                    const value = obj[prop];
                    return <Crdp.Runtime.PropertyPreview>{
                        name: prop.toString(),
                        type: getPropType(value),
                        value: getPropValue(value)
                    };
                })
            };

            return {
                type: 'object',
                description: `Object`,
                preview
            };
        }

        function testObjectPreview(obj: any, expected: string): void {
            assert.equal(Variables.getRemoteObjectPreview(getRemoteObject(obj)), expected);
        }

        test('empty object', () => {
            testObjectPreview({}, 'Object {}');
        });

        test('one-prop object', () => {
            testObjectPreview({ hello: 'world' }, 'Object {hello: "world"}');
        });

        test('small object', () => {
            testObjectPreview({ a: 1, b: 2, c: 3 }, 'Object {a: 1, b: 2, c: 3}');
        });

        test('too big object', () => {
            testObjectPreview({ a: 1, b: 2, c: 3, d: 4 }, 'Object {a: 1, b: 2, c: 3, …}');
        });

        test('complex object', () => {
            testObjectPreview({ a: 'test', b: [1, 2, 3], c: { a: 'test' } }, 'Object {a: "test", b: Array[3], c: Object}');
        });

        /**
         * Test that values are truncated but keys are not
         */
        test('long value object', () => {
            const oneHundredAs = 'a'.repeat(100);
            const fiftyAs = 'a'.repeat(50);
            testObjectPreview({ [oneHundredAs]: oneHundredAs }, `Object {${oneHundredAs}: "${fiftyAs}…"}`);
        });
    });

    suite('createFunctionVariable()', () => {

        const _variableHandles = new Variables.VariableHandles()

        function getFunctionRemoteObject(func: any, funcName: string): any {
            return {
                name: funcName,
                value: <Crdp.Runtime.RemoteObject>{
                    className: 'Function',
                    description: func && func.toString(),
                    objectId: '123',
                    type: 'function',
                }
            }
        }

        test('not empty description', () => {
            const rawObject = getFunctionRemoteObject(() => { console.log(123); return 123; }, 'testFunction');
            const processedObject = Variables.createFunctionVariable(rawObject.name, rawObject.value, 'variables', _variableHandles, '');
            assert.equal(processedObject.value, '() => { … }');
        })

        test('empty description', () => {
            const rawObject = getFunctionRemoteObject(undefined, 'testFunction');
            const processedObject = Variables.createFunctionVariable(rawObject.name, rawObject.value, 'variables', _variableHandles, '');
            assert.equal(processedObject.value, 'function() { … }');
        })
    });

    suite('getRemoteObjectPreview_primitive()', () => {
        function getPrimitiveRemoteObject(value: any, hasDescription: boolean): Crdp.Runtime.RemoteObject {
            return {
                description: hasDescription ? '' + value : undefined,
                value: value,
                type: typeof value,
            }
        }

        function testPrimitiveRemoteObject(obj: any, expected: string): void {
            assert.equal(Variables.getRemoteObjectPreview_primitive(obj, true), expected);
        }

        test('number with description', () => {
            testPrimitiveRemoteObject(getPrimitiveRemoteObject(123, true), '123');
        })

        test('boolean with description', () => {
            testPrimitiveRemoteObject(getPrimitiveRemoteObject(false, true), 'false');
        })

        test('string with description', () => {
            testPrimitiveRemoteObject(getPrimitiveRemoteObject('string', true), '"string"');
        })

        test('undefined with description', () => {
            testPrimitiveRemoteObject(getPrimitiveRemoteObject(undefined, true), 'undefined');
        })

        test('number without description', () => {
            testPrimitiveRemoteObject(getPrimitiveRemoteObject(123, false), '123');
        })

        test('boolean without description', () => {
            testPrimitiveRemoteObject(getPrimitiveRemoteObject(false, false), 'false');
        })

        test('string without description', () => {
            testPrimitiveRemoteObject(getPrimitiveRemoteObject('string', false), '"string"');
        })

        test('undefined without description', () => {
            testPrimitiveRemoteObject(getPrimitiveRemoteObject(undefined, false), 'undefined');
        })
    });

    suite('isIndexedPropName()', () => {
        test('true for positive integers', () => {
            assert(Variables.isIndexedPropName('0'));
            assert(Variables.isIndexedPropName('5'));
            assert(Variables.isIndexedPropName('3457098230456'));
        });

        test('false for anything else', () => {
            assert(!Variables.isIndexedPropName('1.2'));
            assert(!Variables.isIndexedPropName('-5'));
            assert(!Variables.isIndexedPropName('foo'));
            assert(!Variables.isIndexedPropName('1e6'));
        });
    });
});