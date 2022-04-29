address(tuition, '{{contractAddr}}').

abi(tuition, [
  owner: address / view,
  locked: bool / view,
  'TREASURY': address / view,
  previousOwner: address / view,
  isStaff(address): bool / view,
  balance(address): uint256 / view,
  alreadyPaid(address): bool / view,

  % Student
  contribute: payable,

  % Staff
  refundUser(address),
  moveStudentFundsToTreasury(address),

  % Owner
  manageStaff(address, bool),
  renounceOwnership,
  transferOwnership(address),
  changeTreasuryAddress(address),
  permanentlyMoveAllFundsToTreasuryAndLockContract
]).

init :-
  if (is_staff(true) or is_owner(true)) then (
    set(tab, choose),
    set(has_choice, true)
  )
  else (
    set(tab, student)
  ).

prompt :- is_staff(true),  show text('You are staff').
prompt :- is_staff(false), show text('You are not staff').

%%
%% Choose tab
%%
prompt :-
  get(tab, choose),
  show [
    text('What kind of action do you want to take?'),
    button('Student', [ set(tab, student) ])
  ].

prompt :- get(tab, choose), show button('Staff', [ set(tab, staff) ]).
prompt :- get(tab, choose), show button('Admin', [ set(tab, admin) ]).

%%
%% Student tab
%%
prompt :-
  get(tab, student),
  student_prompt.

student_prompt :-
  prompt_once(welcome),
  show text('Welcome to Shipyard\'s Tuition Portal').

student_prompt :-
  has_paid(false),
  show button('Pay Deposit', [
    call_fn(tuition, contribute, [value(eth(1))], [])
  ]).

student_prompt :-
  has_paid(true),
  show text('Congratulations! Your deposit has been registered.').

%%
%% Staff Tab
%%
prompt :- get(tab, staff), show text('Staff (TODO)').

%%
%% Staff Tab
%%
prompt :- get(tab, admin), show text('Admin (TODO)').

%%
%% Helpers
%%
has_paid(Bool) :-
  get(me/address, Addr),
  call_fn(tuition, alreadyPaid(Addr), [{Bool}]).

is_staff(Bool) :-
  get(me/address, Addr),
  call_fn(tuition, isStaff(Addr), [{Bool}]).

is_owner(Bool) :-
  get(me/address, Addr),
  call_fn(tuition, owner, [Owner]),
  (Addr == Owner -> Bool = true; Bool = false).


% For testing
prompt :-
  show button('Owner', [
    call_fn(tuition, owner, [Addr]),
    log(text('Owner address: ', Addr))
  ]).
