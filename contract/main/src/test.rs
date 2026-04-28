#![cfg(test)]

use super::{Error, PollHub, PollHubClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, String, Vec,
};

struct Ctx<'a> {
    env: Env,
    poll: PollHubClient<'a>,
    token: TokenClient<'a>,
    asset_admin: StellarAssetClient<'a>,
    contract_id: Address,
}

fn setup<'a>() -> Ctx<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_id = sac.address();

    let contract_id = env.register(PollHub, (token_id.clone(),));

    Ctx {
        poll: PollHubClient::new(&env, &contract_id),
        token: TokenClient::new(&env, &token_id),
        asset_admin: StellarAssetClient::new(&env, &token_id),
        contract_id,
        env,
    }
}

fn fund(ctx: &Ctx, who: &Address, amount: i128) {
    ctx.asset_admin.mint(who, &amount);
}

fn bump_time(env: &Env, by: u64) {
    let now = env.ledger().timestamp();
    env.ledger().with_mut(|li| {
        li.timestamp = now + by;
    });
}

fn opts2(env: &Env, a: &str, b: &str) -> Vec<String> {
    vec![env, String::from_str(env, a), String::from_str(env, b)]
}
fn opts3(env: &Env, a: &str, b: &str, c: &str) -> Vec<String> {
    vec![
        env,
        String::from_str(env, a),
        String::from_str(env, b),
        String::from_str(env, c),
    ]
}

#[test]
fn create_then_vote_records_quadratic_weight() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let voter = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "tabs or spaces?");
    let labels = opts3(&ctx.env, "tabs", "spaces", "neither");

    fund(&ctx, &voter, 200_000_000);
    let id = ctx.poll.create_poll(&creator, &q, &labels, &600);
    assert_eq!(id, 1);

    let weight = ctx.poll.cast_vote(&voter, &1, &0, &100_000_000);
    assert_eq!(weight, 10_000); // isqrt(100_000_000) = 10_000

    // stake actually moved into escrow
    assert_eq!(ctx.token.balance(&voter), 100_000_000);
    assert_eq!(ctx.token.balance(&ctx.contract_id), 100_000_000);

    let tally = ctx.poll.get_tally(&1, &0);
    assert_eq!(tally.weight_sum, 10_000);
    assert_eq!(tally.stake_sum, 100_000_000);
    assert_eq!(tally.voter_count, 1);

    let stored = ctx.poll.get_vote(&1, &voter).unwrap();
    assert_eq!(stored.option_idx, 0);
    assert_eq!(stored.stake, 100_000_000);
    assert_eq!(stored.released, false);

    let poll = ctx.poll.get_poll(&1).unwrap();
    assert_eq!(poll.total_voters, 1);
    assert_eq!(poll.finalized, false);
    assert_eq!(poll.options.len(), 3);
    assert_eq!(poll.options.get(0).unwrap(), String::from_str(&ctx.env, "tabs"));
    assert_eq!(poll.options.get(1).unwrap(), String::from_str(&ctx.env, "spaces"));
}

#[test]
fn multiple_votes_accumulate_per_option() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let alice = Address::generate(&ctx.env);
    let bob = Address::generate(&ctx.env);
    let carol = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "favorite color?");
    let labels = opts3(&ctx.env, "red", "blue", "green");

    fund(&ctx, &alice, 400_000_000);
    fund(&ctx, &bob, 100_000_000);
    fund(&ctx, &carol, 900_000_000);

    ctx.poll.create_poll(&creator, &q, &labels, &600);

    ctx.poll.cast_vote(&alice, &1, &0, &400_000_000); // weight 20_000
    ctx.poll.cast_vote(&bob, &1, &1, &100_000_000); // weight 10_000
    ctx.poll.cast_vote(&carol, &1, &0, &900_000_000); // weight 30_000

    let opt0 = ctx.poll.get_tally(&1, &0);
    assert_eq!(opt0.voter_count, 2);
    assert_eq!(opt0.stake_sum, 1_300_000_000);
    assert_eq!(opt0.weight_sum, 50_000);

    let opt1 = ctx.poll.get_tally(&1, &1);
    assert_eq!(opt1.voter_count, 1);
    assert_eq!(opt1.stake_sum, 100_000_000);
    assert_eq!(opt1.weight_sum, 10_000);

    let opt2 = ctx.poll.get_tally(&1, &2);
    assert_eq!(opt2.voter_count, 0);
    assert_eq!(opt2.stake_sum, 0);
    assert_eq!(opt2.weight_sum, 0);

    let poll = ctx.poll.get_poll(&1).unwrap();
    assert_eq!(poll.total_voters, 3);

    // every voter is now empty, contract holds the sum
    assert_eq!(ctx.token.balance(&alice), 0);
    assert_eq!(ctx.token.balance(&bob), 0);
    assert_eq!(ctx.token.balance(&carol), 0);
    assert_eq!(ctx.token.balance(&ctx.contract_id), 1_400_000_000);
}

#[test]
fn cannot_vote_twice_in_same_poll() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let voter = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "noon or midnight?");
    let labels = opts2(&ctx.env, "noon", "midnight");

    fund(&ctx, &voter, 1_000_000_000);

    ctx.poll.create_poll(&creator, &q, &labels, &600);
    ctx.poll.cast_vote(&voter, &1, &0, &50_000_000);

    let result = ctx.poll.try_cast_vote(&voter, &1, &1, &100_000_000);
    assert!(matches!(result, Err(Ok(Error::AlreadyVoted))));

    // tallies untouched after rejection
    let opt0 = ctx.poll.get_tally(&1, &0);
    assert_eq!(opt0.voter_count, 1);
    assert_eq!(opt0.stake_sum, 50_000_000);

    let opt1 = ctx.poll.get_tally(&1, &1);
    assert_eq!(opt1.voter_count, 0);
    assert_eq!(opt1.stake_sum, 0);

    // and the rejected vote did not double-charge the voter
    assert_eq!(ctx.token.balance(&voter), 950_000_000);
    assert_eq!(ctx.token.balance(&ctx.contract_id), 50_000_000);
}

#[test]
fn finalize_picks_highest_quadratic_weight() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let whale = Address::generate(&ctx.env);
    let small_a = Address::generate(&ctx.env);
    let small_b = Address::generate(&ctx.env);
    let small_c = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "which proposal?");
    let labels = opts2(&ctx.env, "proposal A", "proposal B");

    fund(&ctx, &whale, 900_000_000);
    fund(&ctx, &small_a, 160_000_000);
    fund(&ctx, &small_b, 160_000_000);
    fund(&ctx, &small_c, 160_000_000);

    ctx.poll.create_poll(&creator, &q, &labels, &600);

    ctx.poll.cast_vote(&whale, &1, &0, &900_000_000); // weight 30_000
    ctx.poll.cast_vote(&small_a, &1, &1, &160_000_000); // weight 12_649
    ctx.poll.cast_vote(&small_b, &1, &1, &160_000_000);
    ctx.poll.cast_vote(&small_c, &1, &1, &160_000_000);

    bump_time(&ctx.env, 700);
    let winner = ctx.poll.finalize(&1);
    assert_eq!(winner, 1);

    let poll = ctx.poll.get_poll(&1).unwrap();
    assert_eq!(poll.finalized, true);
    assert_eq!(poll.winner, 1);

    let opt0 = ctx.poll.get_tally(&1, &0);
    let opt1 = ctx.poll.get_tally(&1, &1);
    assert!(opt0.stake_sum > opt1.stake_sum);
    assert!(opt1.weight_sum > opt0.weight_sum);
}

#[test]
fn release_stake_only_after_finalize() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let voter = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "release me?");
    let labels = opts2(&ctx.env, "yes", "no");

    fund(&ctx, &voter, 81_000_000);

    ctx.poll.create_poll(&creator, &q, &labels, &600);
    ctx.poll.cast_vote(&voter, &1, &0, &81_000_000);

    // mid-poll the voter has been drained
    assert_eq!(ctx.token.balance(&voter), 0);
    assert_eq!(ctx.token.balance(&ctx.contract_id), 81_000_000);

    // pre-finalize release fails
    let early = ctx.poll.try_release_stake(&voter, &1);
    assert!(matches!(early, Err(Ok(Error::NotFinalized))));

    bump_time(&ctx.env, 700);
    ctx.poll.finalize(&1);

    let stake = ctx.poll.release_stake(&voter, &1);
    assert_eq!(stake, 81_000_000);

    // stake is back in the voter's wallet, contract is empty
    assert_eq!(ctx.token.balance(&voter), 81_000_000);
    assert_eq!(ctx.token.balance(&ctx.contract_id), 0);

    let stored = ctx.poll.get_vote(&1, &voter).unwrap();
    assert_eq!(stored.released, true);

    // double release fails
    let again = ctx.poll.try_release_stake(&voter, &1);
    assert!(matches!(again, Err(Ok(Error::AlreadyReleased))));
}

#[test]
fn vote_after_deadline_fails() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let late = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "too late?");
    let labels = opts2(&ctx.env, "yes", "no");

    fund(&ctx, &late, 10_000_000);

    ctx.poll.create_poll(&creator, &q, &labels, &60);
    bump_time(&ctx.env, 120);

    let result = ctx.poll.try_cast_vote(&late, &1, &0, &10_000_000);
    assert!(matches!(result, Err(Ok(Error::PollClosed))));
}

#[test]
fn rejects_empty_question() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "");
    let labels = opts2(&ctx.env, "yes", "no");

    let result = ctx.poll.try_create_poll(&creator, &q, &labels, &600);
    assert!(matches!(result, Err(Ok(Error::QuestionEmpty))));
}

#[test]
fn rejects_empty_option_label() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "real q?");
    let labels = opts2(&ctx.env, "yes", "");

    let result = ctx.poll.try_create_poll(&creator, &q, &labels, &600);
    assert!(matches!(result, Err(Ok(Error::OptionTextEmpty))));
}

#[test]
fn rejects_too_few_or_too_many_options() {
    let ctx = setup();
    let creator = Address::generate(&ctx.env);
    let q = String::from_str(&ctx.env, "ok?");

    // one option
    let one = vec![&ctx.env, String::from_str(&ctx.env, "yes")];
    let r1 = ctx.poll.try_create_poll(&creator, &q, &one, &600);
    assert!(matches!(r1, Err(Ok(Error::InvalidNumOptions))));

    // seven options
    let seven = vec![
        &ctx.env,
        String::from_str(&ctx.env, "a"),
        String::from_str(&ctx.env, "b"),
        String::from_str(&ctx.env, "c"),
        String::from_str(&ctx.env, "d"),
        String::from_str(&ctx.env, "e"),
        String::from_str(&ctx.env, "f"),
        String::from_str(&ctx.env, "g"),
    ];
    let r7 = ctx.poll.try_create_poll(&creator, &q, &seven, &600);
    assert!(matches!(r7, Err(Ok(Error::InvalidNumOptions))));
}
