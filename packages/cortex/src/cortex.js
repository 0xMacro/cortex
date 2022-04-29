/**
 * The Prolog source code for Cortex.
 *
 * Why not have this as a .pl file, you might ask?
 * Because browsers and bundlers have a hard time working with node's `fs` module.
 */
export const CORTEX_BASE_CODE = `
:- use_module(library(lists)).
:- use_module(library(js)).

:- dynamic(effect/1).
:- dynamic(address/2).
:- dynamic(oracle/3).

:- op(290, yfx, '++').
:- op(800, xfx, or).
:- op(950, yfx, '??').
:- op(985, yfx, then).
:- op(985, yfx, else).
:- op(985, yfx, elseif).
:- op(990, fx, if).
:- op(997, fx, show).

%% Useful helper for assert + error messages
'??'(Pred, Err) :- Pred -> true; throw(assert_error(Err)).

%%
%% DSL: if-then-else, or
%%
if(X) :- (if_then(X, Then) -> call(Then); true).

if_then(then(elseif(Try, Cond), MaybeThen), Then) :-
  !,
  (if_then(Try, Then) -> true; call(Cond), Then = MaybeThen).

if_then(then(Cond, Then), Then)  :-
  !,
  call(Cond).

if_then(else(Try, MaybeThen), Then) :-
  !,
  (if_then(Try, Then) -> true; Then = MaybeThen).

or(X,Y) :- call(X) -> true; call(Y).

get_prompts(Prompts) :-
  findall(Prompt, prompt([], Prompt), PromptLists),
  foldl(append, PromptLists, [], Prompts0),
  reverse(Prompts0, Prompts1),
  maplist(resolve_hot_data, Prompts1, Prompts).

prompt_list(Out) :-
  get_prompts(Prompts),
  maplist(serialize_term, Prompts, Out).


resolve_hot_data([], []) :- !.

%% Convert button/2 shorthand to button/3
resolve_hot_data(button(Text, CB), Y) :- !, resolve_hot_data(button(Text, {}, CB), Y).

resolve_hot_data(X, Y) :-
  X =.. [Name | Args0],
  member(Name, [row, col]), % Traverse wrapper elements
  !,
  maplist(resolve_hot_data, Args0, Args),
  Y =.. [Name | Args].

resolve_hot_data(button(Text, {Attrs0}, CB), button(Text, {Attrs}, CB)) :-
  comma_replace(enabled: Code, enabled: Bool, Attrs0, Attrs),
  nonvar(Code), %% Code only remains a variable if a replacement was not found
  !,
  (call(Code) -> Bool = {true}; Bool = {false}).

resolve_hot_data(X, X).


prompt_once(Key) :-
  ground(Key) ?? 'prompt_once key must be ground',
  Key1 = internal__ / prompt_once / Key,
  (get(Key1, true) ->
    false;
    set(Key1, true)
  ).


post_init :-
  register_addresses.

post_init :-
  register_oracles.


register_addresses :-
  current_predicate(address/2),
  address(Id, Addr),
  (ground(Id), ground(Addr)) ?? 'address/2 arguments must be ground',
  apply(registerAddress, [Id, Addr], _),
  retract(address(Id, Addr)).

register_oracles :-
  current_predicate(oracle/3),
  oracle(Id, Perm, Host),
  (ground(Id), ground(Perm), ground(Host)) ?? 'oracle/3 arguments must be ground',
  %% TODO: Validate Host
  apply(registerOracle, [Id, Perm, Host], _),
  retract(oracle(Id, Perm, Host)).

%% TODO: Validate function signatures for better dx
%% post_init :- abi(id, fns), ...


ctx_get(Key, Value) :- path_flat(Key, Path), prop(context, Top), get_(Top, Path, Value).

get(Key, Value) :-
  path_flat(Key, Path),
  get_(Path, Value).

%% Scope input/... keys to inputState
%%
get_([input | Path], Value) :-
  !,
  prop(inputState, Top),
  get_(Top, Path, Value).

get_(Path, Value) :-
  member(TopKey, [context, uiState]),
  prop(TopKey, Top),
  get_(Top, Path, Value),
  !.

get_(Obj, [Key | Rest], Value) :-
  prop(Obj, Key, Next),
  get_(Next, Rest, Value).

get_(Value, [], Value).

set(Path0, Value) :-
  path_flat(Path0, Path),
  apply(setUiState, [Path, Value], _).

path_flat(Path, List) :-
  path_list(Path, List0),
  reverse(List0, List).

path_list(A/B, [B | Rest]) :- !, path_list(A, Rest).
path_list(A, [A]).

%%
%% Contract function calls
%%
call_fn(Contract, Calldata, Result) :-
  call_fn(Contract, Calldata, [], Result).

call_fn(Contract, Calldata, Options0, Result) :-
  parse_call_fn_options(ctx(Contract, Calldata), Options0, Options),
  ground(Contract) ?? contract_not_ground(Contract),
  ground(Calldata) ?? calldata_not_ground(Contract, Calldata),
  is_list(Result) ?? 'Return value must be a list',

  ctx_get(address/Contract, Addr) ?? contract_address_not_found(Contract),
  abi(Contract, Abi) ?? 'Contract ABI not found',

  Calldata =.. [Fn | Args0] ?? 'Invalid Calldata',
  parse_call_fn_args(Contract, Args0, Args),

  (
    member(X, Abi),
    abi_fn(X, FnSig, Ret, Mut),
    FnSig =.. [Fn | ParamsTypes0],
    length(ParamsTypes0, N),
    length(Args, N),
    !
  ) ?? 'ABI function not found',

  maplist(serialize_term, Options, Opts),
  fn_sig_atom(Fn, ParamsTypes0, FnSigAtom, ParamsTypes),
  apply(callFn, [Addr, FnSigAtom, Mut, ParamsTypes, Args, Ret, Opts], Result).

%% TODO: Switch to { key: value } syntax
%%
parse_call_fn_options(Ctx, [X|Xs], [Y|Ys]) :-
  ground(X) ?? unground_fn_call_option(X, Ctx),
  (
    % TODO: Add more options here when needed
    value(eth(N0)) = X, number(N0) ?? invalid_fn_call_option(eth(N0), Ctx) ->
      N is N0 * 10.0 ** 18.0,
      Y = value(N);
    value(N) = X, number(N) ?? invalid_fn_call_option(N, Ctx) ->
      Y = X;
    false
  ) ?? invalid_call_fn_option(X, Ctx),
  parse_call_fn_options(Ctx, Xs, Ys).

parse_call_fn_options(_, [], []).


parse_call_fn_args(Ctx, [X|Xs], [Y|Ys]) :-
  ground(X) ?? unground_fn_call_arg(X, Ctx),
  (
    %% Convert tuple(x,y) to [x, y]
    %%
    X =.. [tuple | TupleArgs] ->
    Y = TupleArgs;
    Y = X
  ),
  parse_call_fn_args(Ctx, Xs, Ys).

parse_call_fn_args(_, [], []).


%% Stringify params and function sig to ethers-compatible strings
%%
fn_sig_atom(Fn, Params, Atom, EthersParams) :-
  findall(Str, (member(P, Params), fn_sig_atom_(P, Str)), EthersParams),
  atomic_list_concat(EthersParams, ',', ParamsAtom),
  atomic_list_concat([Fn, '(', ParamsAtom, ')'], Atom).

fn_sig_atom_(array(Type), Atom) :-
  !,
  fn_sig_atom_(Type, Atom0),
  atom_concat(Atom0, '[]', Atom).

fn_sig_atom_(Tuple, Atom) :-
  Tuple =.. [tuple | Types],
  !,
  findall(A, (member(T, Types), fn_sig_atom_(T, A)), Atoms),
  atomic_list_concat(Atoms, ',', TypesAtom),
  atomic_list_concat(['(', TypesAtom, ')'], Atom).

fn_sig_atom_(Type, Type).

%%
%% Oracle HTTP calls
%%
get_http(Contract, Calldata, Result) :-
  get_http(Contract, Calldata, Result, []).

get_http(Oracle, Path, Result, Options) :-
  call_http(Oracle, 'GET', Path, [200, _, Result], Options).

%% Res is expected to be in the format:
%% [StatusCode, Headers, JsonObject]
%%
call_http(Oracle, Method, Path, Res, Options0) :-
  parse_call_http_options(ctx(Oracle, Path), Options0, Options),
  ground(Oracle) ?? 'Oracle must be ground',
  ground(Path) ?? 'Path must be ground',

  ctx_get(oracle/Oracle/host, Host) ?? oracle_not_found(Oracle),

  %% TODO: Check for and allow POST/PUT/DELETE
  %% ctx_get(oracle/Oracle/permission, Perm),

  ground(Path) ?? path_not_ground(Path),
  resolve_url(Host, Path, Url) ?? invalid_url(Host, Path),

  apply(callHttp, [Method, Url, Options], Res).

parse_call_http_options(Ctx, [Key: Value | Xs], [[Key, Value] | Ys]) :-
  !,
  parse_call_http_options(Ctx, Xs, Ys).

parse_call_http_options(Ctx, [X | _], _) :- throw(invalid_call_http_option(X, Ctx)).

parse_call_http_options(_, [], []).

%% TODO: Use term expansion to resolve ++ generically. Maybe.
%%
resolve_url(Host, A ++ B, Result) :-
  !,
  to_atom(A, A1),
  to_atom(B, B1),
  atom_concat(A1, B1, C),
  resolve_url(Host, C, Result).

resolve_url(Host, Path, Result) :-
  atom_concat('https://', Host, Origin),
  atom_concat(Origin, Path, Result).


to_atom(X, X) :- atom(X), !.
to_atom(X, Y) :- number(X), !, atom_number(Y, X).
to_atom(X, _) :- throw(cannot_convert_to_atom(X)).

%%
%% Parses our prolog term DSL into function return type and mutability data.
%%
%% Examples:
%%
%%   abi_fn(foo(10): bool, foo(10), [bool], []).
%%   abi_fn(foo(10): view, foo(10), [], [view]).
%%   abi_fn(foo(10): bool / view, foo(10), [bool], [view]).
%%
abi_fn(FnSig: RetMut, FnSig, Ret, Muts) :-
  !,
  abi_fn_retmut(RetMut, Ret0, Muts),
  % Hack to avoid matching terms that specify more than one return type
  _/_ \\= Ret0,
  (Ret0 = void -> Ret = []; Ret = [Ret0]).

abi_fn(FnSig, FnSig, [], []).

%
% TODO: Require non-mutability is listed first lexically
%
abi_fn_retmut(Xs / X, Ret, [X|Muts]) :-
  is_mutability(X),
  !,
  abi_fn_retmut(Xs, Ret, Muts).

abi_fn_retmut(Xs / X, X, Muts) :-
  !,
  abi_fn_retmut(Xs, X, Muts).

abi_fn_retmut(X, Ret, [X]) :-
  is_mutability(X),
  !,
  (ground(Ret) -> true; Ret = void).

abi_fn_retmut(X, X, []).


is_mutability(X) :- member(X, [pure, view, payable]).


prompt_exists(Query, P) :-
  P =.. [Name | Args],
  member(Name, [row, col]), % Support wrapper elements
  !,
  member(SubPrompt, Args),
  prompt_exists(Query, SubPrompt).

prompt_exists(Query, P) :-
  subsumes_term(Query, P),
  Query = P.


%%
%% Serialize to / deseralize from JavaScript terms
%%
serialize_term(X, X) :-
  (\\+ compound(X)) or member(X, [{true}, {false}, {null}, {undefined}]),
  !.

serialize_term({CommaList}, Obj) :-
  !,
  % Note: Ignores terms that don't match Key: Value syntax
  findall(K-V, (comma_member(K: V0, CommaList), serialize_term(V0, V)), Pairs),
  json_prolog(Obj, Pairs).

serialize_term(X, ['[list]' | Y]) :-
  is_list(X),
  !,
  maplist(serialize_term, X, Y).

serialize_term(X, [Atom | Args]) :-
  X =.. [Atom | Args0],
  maplist(serialize_term, Args0, Args).


% TODO
% Will need to implement once we switch call_fn syntax to use {}/1
% deserialize_term(Obj, {CommaList}) :-

deserialize_term(Y, Y) :- \\+ compound(Y), !.

deserialize_term(['[list]' | ListItems0], ListItems) :-
  !,
  maplist(deserialize_term, ListItems0, ListItems).

deserialize_term([Atom | Args0], X) :-
  maplist(deserialize_term, Args0, Args),
  X =.. [Atom | Args].


comma_member(X, (X, _)).
comma_member(X, (_, Rest)) :- comma_member(X, Rest).
comma_member(X, X) :- \\+ X = (_, _).

comma_replace(From, To, (From, Xs), (To, Ys)) :- !, comma_replace(From, To, Xs, Ys).
comma_replace(From, To, (X,    Xs), (X,  Ys)) :- dif(X, From), comma_replace(From, To, Xs, Ys).
comma_replace(From, To,         X,         Y) :-
  \\+ X = (_, _),
  (X = From -> Y = To; Y = X).

ends_with(Ending, Atom) :- atom_concat(_, Ending, Atom).

%%
%% Execution and effects
%%

%% Expects a list of actions.
%% Example payload:
%%   ['[list]', [foo, 10, 20], [bar, 30]]
%%
execute_all(Payload, Effects) :-
  retractall(effect(_)),
  (['[list]' | ActionLists] = Payload) ?? invalid_actions_1(Payload),
  maplist(deserialize_term, ActionLists, Actions) ?? invalid_actions_2(ActionLists),
  execute_all_(Actions),
  findall(E, effect(E), Effects).

execute_all_([Action | Rest]) :-
  call(Action) ?? action_failed(Action),
  execute_all_(Rest).

execute_all_([]).

log(Term) :-
  log(notice, Term).

log(Type, Term) :-
  assertz(effect(log(Type, Term))).


%%
%% DSL: Transforms prompt / show(X) to prompt(In,Out) / show(X,A,B)
%%
%% We define the term_expansion down here so Tau doesn't attempt to expand the above code.
%%

%% Append a prompt to a list of results.
%% Normalize lists, maintaining reverse order.
%%
show([], In, In) :-
  !.
show([P | Ps], In, Results) :-
  !,
  show(Ps, [P | In], Results).
show(P, In, [P | In]).


%% Boilerplate iteration
%%
prompts_expansion(CurrentVar, ResultVar, (G0, Gs0), (G, Gs)) :-
  !,
  prompt_expansion(CurrentVar, NextVar, G0, G),
  prompts_expansion(NextVar, ResultVar, Gs0, Gs).

prompts_expansion(CurrentVar, ResultVar, G0, G) :-
  prompt_expansion(CurrentVar, ResultVar, G0, G).


%% Expand show/1 and any predicates that end with _prompt
%%
prompt_expansion(CurrentVar, NextVar, show(Prompt), show(Prompt, CurrentVar, NextVar)) :- !.

prompt_expansion(CurrentVar, NextVar, Goal0, Goal) :-
  Goal0 =.. [Name | Args0],
  ends_with('_prompt', Name),
  !,
  append(Args0, [CurrentVar, NextVar], Args),
  Goal =.. [Name | Args].

prompt_expansion(CurrentVar, CurrentVar, X, X).


%% The actual term expansion definition.
%% Prolog will attempt to expand every rule using these patterns.
%%
term_expansion((prompt :- RawBody), (prompt(In, Out) :- Body)) :-
  prompts_expansion(In, Out, RawBody, Body).

term_expansion((Helper :- RawBody), (HelperTransformed :- Body)) :-
  Helper =.. [Name | Args0],
  ends_with('_prompt', Name),
  prompts_expansion(In, Out, RawBody, Body),
  append(Args0, [In, Out], Args),
  HelperTransformed =.. [Name | Args].

`
