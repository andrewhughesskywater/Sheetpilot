# Function Naming Conventions

rules:
  - name: Function Naming Conventions
    appliesTo:
      - typescript
      - javascript
      - react
      - node
      - shared
    description: >
      Enforces standards for function, method, variable, React component, and constant naming.
    details:
      - Use `camelCase` for all function, method, and variable names, except as noted below.
      - Use `PascalCase` for:
          - React components
          - Classes
          - Types/interfaces/enums
      - Use `UPPER_SNAKE_CASE` for constants and configuration values.
      - `lower_snake_case` is not allowed for function names.
      - React hooks **must** start with `use` and follow `useXxx` (`use + PascalCaseNoun` or `use + Verb + Noun`).
      - Boolean returning functions **must** start with one of: `is`, `has`, `can`, or `should`.
      - Event handlers **must** start with `handle` or `on`.
      - Private/internal methods **should** be prefixed with a single underscore (`_`).
      - Repository, service, and shared-layer utility methods should use a clear semantic prefix (see below).
      - **Avoid** generic, abbreviated, or non-semantic names (see prohibited patterns).

    semanticPrefixes:
      ReactHooks:
        prefix: "use"
        pattern: "use + PascalCaseNoun | use + Verb + Noun"
        mustUsePrefix: true
      DataAccess:
        get:
          prefix: "get"
          description: Read/derive synchronously, no side effects
          pattern: "get + Noun" | "get + Adjective + Noun"
        fetch:
          prefix: "fetch"
          description: Async data retrieval (network/db/api)
          pattern: "fetch + Noun"
        load:
          prefix: "load"
          description: Bring into memory/cache (may have side effects)
          pattern: "load + Noun"
      DataModification:
        set:
          prefix: "set"
          description: Set/update a value (may return new value or void)
          pattern: "set + [Adjective] + Noun"
        create:
          prefix: "create"
          description: Create new instance/entity
          pattern: "create + Noun"
        update:
          prefix: "update"
          description: Update existing entity
          pattern: "update + Noun"
        save:
          prefix: "save"
          description: Persist data (may be async)
          pattern: "save + Noun"
        delete:
          prefix: "delete"
          description: Remove from db/filesystem
          pattern: "delete + Noun"
        remove:
          prefix: "remove"
          description: Remove from in-memory context
          pattern: "remove + Noun"
      BooleanChecks:
        is:
          prefix: "is"
          description: Predicate (Adjective/Condition)
          pattern: "is + Adjective" | "is + Noun + Adjective"
        has:
          prefix: "has"
          description: Predicate/Existence/Flags
          pattern: "has + Noun"
        can:
          prefix: "can"
          description: Predicate/capability/permission
          pattern: "can + Verb"
        should:
          prefix: "should"
          description: Predicate/recommendation/condition
          pattern: "should + Verb"
      Validation:
        validate:
          prefix: "validate"
          description: Validation that returns a result or throws
          pattern: "validate + Noun"
        check:
          prefix: "check"
          description: Check with possible result object
          pattern: "check + Noun"
        assert:
          prefix: "assert"
          description: Test assertion, throws on failure
          pattern: "assert + Adjective + Noun"
      EventHandlers:
        handle:
          prefix: "handle"
          description: Event handler for user/event/etc.
          pattern: "handle + [Noun] + Verb"
        on:
          prefix: "on"
          description: Event registration/callback
          pattern: "on + [Noun] + Verb | on + Verb"
      ProcessingAndTransformation:
        process:
          prefix: "process"
          pattern: "process + Noun"
        parse:
          prefix: "parse"
          pattern: "parse + Noun"
        format:
          prefix: "format"
          pattern: "format + Noun"
        convert:
          prefix: "convert"
          pattern: "convert + Preposition + Noun"
        transform:
          prefix: "transform"
          pattern: "transform + Noun"
        normalize:
          prefix: "normalize"
          pattern: "normalize + Noun"
        extract:
          prefix: "extract"
          pattern: "extract + Noun"
      Construction:
        build:
          prefix: "build"
          pattern: "build + Noun"
        construct:
          prefix: "construct"
          pattern: "construct + Noun"
      Workflow:
        submit:
          prefix: "submit"
          pattern: "submit + Noun"
        cancel:
          prefix: "cancel"
          pattern: "cancel + Noun"
        reset:
          prefix: "reset"
          pattern: "reset + [Adjective] + Noun"
      Utilities:
        custom:
          allowNoPrefix: true
          pattern: "[DescriptiveVerb] + Noun" # e.g. `calculateHours`, `mergeErrors`
      Initialization:
        initialize:
          prefix: "initialize"
          pattern: "initialize + Noun"
        setup:
          prefix: "setup"
          pattern: "setup + Noun + Test"
        configure:
          prefix: "configure"
          pattern: "configure + Noun"
      LookupAndResolution:
        resolve:
          prefix: "resolve"
          pattern: "resolve + Noun"
        find:
          prefix: "find"
          pattern: "find + Noun"


    reactComponents:
      - Name: PascalCase (e.g. `LoginDialog`, `TimesheetGrid`)
      - Should be descriptive nouns or `Adjective + Noun`
      - Props interface: `ComponentNameProps` (e.g., `LoginDialogProps`)

    privateFunctions:
      - Prefix with single underscore (`_`)
      - Pattern: `_ + camelCase`

    layerSpecific:
      backendServices:
        - Service classes: `NounService`
        - Service methods: use semantic prefixes above
        - Repository methods: `get`, `save`, `delete`, `update`
      frontendServices:
        - IPC service functions: use semantic prefixes
        - Utility: descriptive verb+noun (e.g. `formatDateForDisplay`)
      sharedCode:
        - Utility functions: no prefix required, but must be descriptive
        - Type guards: start with `is`
        - Constants: UPPER_SNAKE_CASE

    prohibitedPatterns:
      - lower_snake_case for functions (use camelCase)
      - Generic names: `do()`, `run()`, `execute()` (be specific)
      - Abbreviations except well-known ones: `calc()` → `calculate()`, `fmt()` → `format()`
      - Hungarian notation: `strName`, `intCount` (use TypeScript types instead)
      - Single-letter function names (except for very concise utilities in special cases)

    examples:
      good:
        - function getUserData() {}
        - const processTimesheet = () => {}
        - class TimesheetService {}
        - const MAX_RETRY_COUNT = 3
        - export function useTheme() {}
        - export function isValidDate() {}
        - export function validateField() {}
        - export function handleSubmit() {}
        - export function processEntriesByQuarter() {}
        - export function TimesheetGrid() {}

      bad:
        - function get_user_data() {}  # Should be getUserData
        - const ProcessData = () => {} # Should be processData
        - function data() {}           # Should be getData or fetchData
        - function check() {}          # Should be checkSomething
        - function run() {}            # Should be processSomething or executeSomething
        - function do() {}
        - function execute() {}
        - function handle() {}         # Should be handleSomething
        - function calc() {}           # Should be calculate()
        - function fmt() {}            # Should be format()

    enforcement:
      - All function names MUST follow camelCase (React components: PascalCase)
      - Semantic prefixes should be chosen based on purpose
      - React hooks must start with `use`
      - Boolean functions must start with `is`, `has`, `can`, or `should`
      - Event handlers must start with `handle` or `on`
      - Private methods must start with `_`
      - Constants must use UPPER_SNAKE_CASE

    migration:
      - Gradually migrate from snake_case to camelCase for function names.
      - Priority: bot service layer functions.
      - Migrate test utilities as test code is refactored.
