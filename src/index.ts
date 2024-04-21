export type LinearConfig = {
    maxLinear: number
    linearPercent: number
}

export type Bounds = {
    min: number
    max: number
}

export type SliderCalculator = {
    stepToModel: (step: number) => number
    modelToStep: (model: number) => number
    config: ResolvedConfig
}

export type ResolvedConfig = {
    steps: number
    linearAbsolute: number
    linearPercent: number
    min: number
    max: number
    range: number
}

export function useExponentialSlider(
    steps: number,
    bounds: Bounds,
    linear?: LinearConfig,
): SliderCalculator {
    const config = resolveConfig(steps, bounds, linear)
    return {
        stepToModel: (step: number) => stepToModelInternal(step, config),
        modelToStep: (model: number) => modelToStepInternal(model, config),
        config,
    }
}

export function stepToModel(
    step: number,
    steps: number,
    bounds: Bounds,
    linear?: LinearConfig,
): number {
    return stepToModelInternal(step, resolveConfig(steps, bounds, linear))
}

export function stepToModelInternal(
    step: number,
    config: ResolvedConfig,
): number {
    const { linearPercent, linearAbsolute, steps, range, min, max } = config
    step = limitBounds(step, { min: 0, max: steps })

    const percent = step / steps

    if (linearAbsolute >= max) {
        return percent * range + min
    }

    if (percent <= linearPercent) {
        const percentOfAbsolute =
            linearPercent > 0 ? percent / linearPercent : 0
        return percentOfAbsolute * linearAbsolute + min
    }

    const linear =
        linearPercent > 0
            ? (Math.min(percent, linearPercent) / linearPercent) *
              linearAbsolute
            : 0

    const rangeExponential = range - linearAbsolute

    const remainder = step - steps * linearPercent
    const expPercent = 1 - linearPercent
    const percentOfMax = remainder / (steps * expPercent)
    const expVal = percentOfMax * rangeExponential

    return linear + expRange(expVal, 0, rangeExponential) + min
}

export function modelToStep(
    model: number,
    steps: number,
    bounds: Bounds,
    linear?: LinearConfig,
): number {
    return modelToStepInternal(model, resolveConfig(steps, bounds, linear))
}

export function modelToStepInternal(
    model: number,
    config: ResolvedConfig,
): number {
    const { linearPercent, linearAbsolute, steps, range, min, max } = config
    model = limitBounds(model, { min, max })

    const actualValue = Math.max(model - min, 0)

    if (linearAbsolute >= max) {
        const percent = actualValue / range

        return Math.round(percent * steps)
    }

    if (linearAbsolute > 0 && actualValue <= linearAbsolute) {
        const percent = (actualValue / linearAbsolute) * linearPercent

        return Math.round(percent * steps)
    }

    const remainderValue = actualValue - linearAbsolute
    const rangeExponential = range - linearAbsolute
    const dynamicPercent = 1 - linearPercent

    const percentOfMax =
        rootRange(remainderValue, 0, rangeExponential) / rangeExponential

    return Math.round(
        steps * linearPercent + percentOfMax * steps * dynamicPercent,
    )
}

export function resolveConfig(
    steps: number,
    bounds: Bounds,
    linear?: LinearConfig,
): ResolvedConfig {
    linear ||= {
        maxLinear: 0,
        linearPercent: 0,
    }
    const linearPercent = linear.linearPercent / 100
    const linearAbsolute = Math.min(
        linear.maxLinear,
        Math.round(bounds.max * linearPercent),
    )
    const max = linear.linearPercent === 100 ? linear.maxLinear : bounds.max

    return {
        steps: steps,
        linearAbsolute: linearAbsolute,
        linearPercent: linearPercent,
        min: bounds.min,
        max: max,
        range: max - bounds.min,
    }
}

export function limitBounds(
    value: number,
    bounds: { min: number; max: number },
): number {
    return Math.min(Math.max(value, bounds.min), bounds.max)
}

function expRange(value: number, min: number, max: number): number {
    const range = max - min

    return Math.pow(value / range, 2) * range + min
}

function rootRange(value: number, min: number, max: number): number {
    const range = max - min

    return Math.sqrt(Math.max(0, value - min) / range) * range
}

if (import.meta.vitest) {
    const { describe, test, expect } = import.meta.vitest

    describe('Resolve Config', () => {
        test('Happy Path Config', () => {
            expect(
                resolveConfig(
                    1000,
                    { min: 500, max: 1_500_000 },
                    {
                        maxLinear: 15_000,
                        linearPercent: 75,
                    },
                ),
            ).toStrictEqual({
                steps: 1000,
                linearAbsolute: 15_000,
                linearPercent: 0.75,
                min: 500,
                max: 1_500_000,
                range: 1_499_500,
            })
        })
        test('Linear percent 99', () => {
            expect(
                resolveConfig(
                    1000,
                    { min: 500, max: 1_500_000 },
                    {
                        maxLinear: 15_000,
                        linearPercent: 99,
                    },
                ),
            ).toStrictEqual({
                steps: 1000,
                linearAbsolute: 15_000,
                linearPercent: 0.99,
                min: 500,
                max: 1_500_000,
                range: 1_499_500,
            })
        })
        test('Linear percent 100', () => {
            expect(
                resolveConfig(
                    1000,
                    { min: 500, max: 1_500_000 },
                    {
                        maxLinear: 15_000,
                        linearPercent: 100,
                    },
                ),
            ).toStrictEqual({
                steps: 1000,
                linearAbsolute: 15_000,
                linearPercent: 1,
                min: 500,
                max: 15_000,
                range: 14_500,
            })
        })
        test('Very low max', () => {
            expect(
                resolveConfig(
                    1000,
                    { min: 500, max: 12_000 },
                    {
                        maxLinear: 15_000,
                        linearPercent: 90,
                    },
                ),
            ).toStrictEqual({
                steps: 1000,
                linearAbsolute: 10_800,
                linearPercent: 0.9,
                min: 500,
                max: 12000,
                range: 11_500,
            })
        })
        test('No Linear Config', () => {
            expect(
                resolveConfig(1000, { min: 500, max: 12_000 }),
            ).toStrictEqual({
                steps: 1000,
                linearAbsolute: 0,
                linearPercent: 0,
                min: 500,
                max: 12000,
                range: 11_500,
            })
        })
    })

    describe('test', () => {
        function testBackAndForth(
            testName: string,
            steps: number,
            bounds: Bounds,
            linearConfig?: LinearConfig,
        ) {
            test(`${testName}: Test Step to Model and Back via functions`, () => {
                for (let step = 0; step <= steps; step++) {
                    const model = stepToModel(step, steps, bounds, linearConfig)
                    const stepForModel = modelToStep(
                        model,
                        steps,
                        bounds,
                        linearConfig,
                    )
                    expect(step).toBe(stepForModel)
                }
            })
            test(`${testName}: Test Step to Model and Back via useExponentialSlider`, () => {
                const { stepToModel, modelToStep } = useExponentialSlider(
                    steps,
                    bounds,
                    linearConfig,
                )
                for (let step = 0; step <= steps; step++) {
                    const model = stepToModel(step)
                    const stepForModel = modelToStep(model)
                    expect(step).toBe(stepForModel)
                }
            })
        }

        testBackAndForth(
            'Regular Config',
            10_000,
            {
                min: 500,
                max: 125_000,
            },
            {
                maxLinear: 15_000,
                linearPercent: 75,
            },
        )
        testBackAndForth(
            'Max Linear Equal to Max',
            10_000,
            {
                min: 500,
                max: 100_000,
            },
            {
                maxLinear: 100_000,
                linearPercent: 75,
            },
        )
        testBackAndForth(
            'Linear percent 100 all linear',
            10_000,
            {
                min: 500,
                max: 1_500_000,
            },
            {
                maxLinear: 1_000_000,
                linearPercent: 100,
            },
        )
        testBackAndForth('No Linear Config', 10_000, {
            min: 500,
            max: 1_500_000,
        })

        const steps = 1000
        const linearConfig: LinearConfig = {
            maxLinear: 15_000,
            linearPercent: 75,
        }

        const bounds: Bounds = {
            min: 500,
            max: 1_250_000,
        }

        test('Model to Step', () => {
            expect(
                modelToStep(500, steps, bounds, linearConfig).toFixed(0),
            ).toBe('0')
            expect(
                modelToStep(1_250_000, steps, bounds, linearConfig).toFixed(0),
            ).toBe('1000')
            expect(
                modelToStep(6500, steps, bounds, linearConfig).toFixed(0),
            ).toBe('300')

            expect(
                modelToStep(
                    1_250_000,
                    1000,
                    {
                        min: 500,
                        max: 1_250_000,
                    },
                    {
                        maxLinear: 1_500_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('1000')

            expect(
                modelToStep(
                    1_000_000,
                    1000,
                    {
                        min: 500,
                        max: 1_250_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 100,
                    },
                ).toFixed(0),
            ).toBe('1000')

            expect(
                modelToStep(
                    1_000_000,
                    1000,
                    {
                        min: 500,
                        max: 1_250_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 100,
                    },
                ).toFixed(0),
            ).toBe('1000')

            expect(
                modelToStep(
                    750_500,
                    1000,
                    {
                        min: 500,
                        max: 1_000_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('750')

            expect(
                modelToStep(
                    799685,
                    1000,
                    {
                        min: 500,
                        max: 1_000_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('861')

            expect(
                modelToStep(
                    900_000,
                    1000,
                    {
                        min: 500,
                        max: 1_000_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('944')

            expect(
                modelToStep(
                    1_000_000,
                    1000,
                    {
                        min: 500,
                        max: 1_000_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('1000')
        })

        test('Step to Model', () => {
            expect(stepToModel(0, steps, bounds, linearConfig).toFixed(0)).toBe(
                '500',
            )
            expect(
                stepToModel(500, steps, bounds, linearConfig).toFixed(0),
            ).toBe('10500')
            expect(
                stepToModel(600, steps, bounds, linearConfig).toFixed(0),
            ).toBe('12500')
            expect(
                stepToModel(750, steps, bounds, linearConfig).toFixed(0),
            ).toBe('15500')
            expect(
                stepToModel(998, steps, bounds, linearConfig).toFixed(0),
            ).toBe('1230327')
            expect(
                stepToModel(999, steps, bounds, linearConfig).toFixed(0),
            ).toBe('1240144')
            expect(
                stepToModel(1000, steps, bounds, linearConfig).toFixed(0),
            ).toBe('1250000')
            expect(
                stepToModel(6500, steps, bounds, linearConfig).toFixed(0),
            ).toBe('1250000')
            expect(
                stepToModel(
                    999,
                    1000,
                    {
                        min: 500,
                        max: 1_250_000,
                    },
                    {
                        maxLinear: 1_500_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('1247509')
            expect(
                stepToModel(
                    999,
                    1000,
                    {
                        min: 500,
                        max: 1_250_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 100,
                    },
                ).toFixed(0),
            ).toBe('999001')
            expect(
                stepToModel(
                    1000,
                    1000,
                    {
                        min: 500,
                        max: 1_250_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 100,
                    },
                ).toFixed(0),
            ).toBe('1000000')
            expect(
                stepToModel(
                    0,
                    1000,
                    {
                        min: 500,
                        max: 1_250_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 100,
                    },
                ).toFixed(0),
            ).toBe('500')
            expect(
                stepToModel(749, steps, bounds, linearConfig).toFixed(0),
            ).toBe('15480')
            expect(
                stepToModel(750, steps, bounds, linearConfig).toFixed(0),
            ).toBe('15500')
            expect(
                stepToModel(
                    750,
                    1000,
                    {
                        min: 500,
                        max: 1_000_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('750500')

            expect(
                stepToModel(
                    861,
                    1000,
                    {
                        min: 500,
                        max: 1_000_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('799685')

            expect(
                stepToModel(
                    944,
                    1000,
                    {
                        min: 500,
                        max: 1_000_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('900743')

            expect(
                stepToModel(
                    1000,
                    1000,
                    {
                        min: 500,
                        max: 1_000_000,
                    },
                    {
                        maxLinear: 1_000_000,
                        linearPercent: 75,
                    },
                ).toFixed(0),
            ).toBe('1000000')
        })

        test('Happy Path', () => {
            const initialModel = 6500

            const step = modelToStep(initialModel, steps, bounds, linearConfig)

            const modelAfter = stepToModel(step, steps, bounds, linearConfig)

            expect(step.toFixed(0)).toBe('300')
            expect(modelAfter.toFixed(0)).toBe('6500')
        })

        test('Model lower than Min', () => {
            const initialModel = 300

            const step = modelToStep(initialModel, steps, bounds, linearConfig)

            const modelAfter = stepToModel(step, steps, bounds, linearConfig)

            expect(step.toFixed(0)).toBe('0')
            expect(modelAfter.toFixed(0)).toBe('500')
        })

        test('Model higher than Max', () => {
            const initialModel = 1_500_000

            const step = modelToStep(initialModel, steps, bounds, linearConfig)

            const modelAfter = stepToModel(step, steps, bounds, linearConfig)

            expect(step.toFixed(0)).toBe('1000')
            expect(modelAfter.toFixed(0)).toBe('1250000')
        })

        test('No Linear Config', () => {
            const step = 0
            const model = stepToModel(step, 10_000, {
                min: 500,
                max: 1_500_000,
            })
            const stepForModel = modelToStep(model, 10_000, {
                min: 500,
                max: 1_500_000,
            })
            expect(step).toBe(stepForModel)
        })

        test('No Linear Config 2', () => {
            const step = 15
            const model = stepToModel(step, 10_000, {
                min: 500,
                max: 1_500_000,
            })
            const stepForModel = modelToStep(model, 10_000, {
                min: 500,
                max: 1_500_000,
            })
            expect(step).toBe(stepForModel)
        })
    })
}
