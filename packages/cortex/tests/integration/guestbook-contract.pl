address(guestbook, '{{contractAddr}}').

init :-
  set(tab, choose).

prompt :- get(tab, choose), choose_prompt.
prompt :- get(tab, create), create_prompt.
prompt :- get(tab, open),   open_prompt.
prompt :- get(tab, view),   get(guestbookId, Id), view_prompt(Id).

%%
%% Choose Prompt
%%
choose_prompt :- show button('Open a Guestbook', [ set(tab, open) ]).

choose_prompt :-
  my_guestbook(Id),
  show [
    button('Open My Guestbook', [
      set(viewingGuestbookId, Id),
      set(tab, view)
    ])
  ].

choose_prompt :-
  \+ has_guestbook,
  show [
    button('Create Guestbook', [
      set(tab, create)
    ])
  ].

%%
%% Open Prompt
%%
open_prompt :-
  show [
    row(
      col(
        text('Owner address:'),
        input(address, owner)
      ),

      button('Open Guestbook', { enabled: get(input/owner, _) }, [
        open_guestbook
      ])
    )
  ].

open_guestbook :-
  get(input/owner, Owner),
  if get_guestbook(Owner, Id) then (
    set(guestbookId, Id),
    set(tab, view)
  )
  else (
    log(text('No such guestbook for that address.'))
  ).

%%
%% View Prompt
%%
view_prompt(GuestbookId) :-
  show [
    text('Viewing Guestbook #', GuestbookId),
    debug(viewing(GuestbookId))
  ].

view_prompt(GuestbookId) :-
  get_lastest_entry(GuestbookId, [SignerAddr, GiftAmt, Message]),
  show [
    text('Latest entry from ', SignerAddr),
    text('"', Message, '"'),
    debug(latest_entry([SignerAddr, GiftAmt, Message]))
  ].

view_prompt(GuestbookId) :-
  show [
    text('New Entry'),
    row(
      text('ETH to Gift'),
      input(eth, entry_eth)
    ),
    row(
      text('Message'),
      input(string, entry_message)
    ),
    button('Submit', {
      enabled: (get(input/entry_eth, _), get(input/entry_message, _))
    }, [
      create_entry(GuestbookId)
    ])
  ].

create_entry(GuestbookId) :-
  get(input/entry_eth, Eth),
  get(input/entry_message, Message),
  call_fn(guestbook, sign(GuestbookId, Message), [value(eth(Eth))], []).

%%
%% Helpers: Guestbook
%%
get_guestbook(Owner, Id) :-
  call_fn(guestbook, guestbooks(Owner), [Id]),
  \+ Id = 0.

my_guestbook(Id) :-
  get(me/address, Addr),
  get_guestbook(Addr, Id).

has_guestbook :- my_guestbook(_).

%%
%% Helpers: Entries
%%
get_lastest_entry(GuestbookId, Entry) :-
  call_fn(guestbook, entryCount(GuestbookId), [Count]),
  \+ Count = 0,
  N is Count - 1,
  call_fn(guestbook, entries(GuestbookId, N), Entry).

%%
%% Boilerplate (you can generate this)
%%
abi(guestbook, [
  balances(address): uint256 / view,
  create: uint256,
  entries(uint256, uint256): tuple(address, uint256, string) / view,
  entryCount(uint256): uint256 / view,
  guestbooks(address): uint256 / view,
  sign(uint256, string): payable
]).
