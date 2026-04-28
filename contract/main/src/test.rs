#![cfg(test)]

use super::{Error, PollHub, PollHubClient};
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env, String};

fn setup<'a>() -> (Env, PollHubClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(PollHub, ());
    (env.clone(), PollHubClient::new(&env, &id))
}

fn bump_time(env: &Env, by: u64) {
    let now = env.ledger().timestamp();
    env.ledger().with_mut(|li| {
        li.timestamp = now + by;
    });
}

#[test]
fn create_then_vote_records_quadratic_weight() {
    let (env, c) = setup();
    let creator = Address::generate(&env);
    let voter = Address::generate(&env);
    let q = String::from_str(&env, "tabs or spaces?");

    let id = c.create_poll(&creator, &q, &3, &600);
    assert_eq!(id, 1);

    let weight = c.cast_vote(&voter, &1, &0, &100_000_000);
    // isqrt(100_000_000) = 10_000
    assert_eq!(weight, 10_000);

    let tally = c.get_tally(&1, &0);
    assert_eq!(tally.weight_sum, 10_000);
    assert_eq!(tally.stake_sum, 100_000_000);
    assert_eq!(tally.voter_count, 1);

    let stored = c.get_vote(&1, &voter).unwrap();
    assert_eq!(stored.option_idx, 0);
    assert_eq!(stored.stake, 100_000_000);
    assert_eq!(stored.released, false);

    let poll = c.get_poll(&1).unwrap();
    assert_eq!(poll.total_voters, 1);
    assert_eq!(poll.finalized, false);
}

#[test]
fn multiple_votes_accumulate_per_option() {
    let (env, c) = setup();
    let creator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    let q = String::from_str(&env, "favorite color?");

    c.create_poll(&creator, &q, &3, &600);

    c.cast_vote(&alice, &1, &0, &400_000_000); // weight 20_000
    c.cast_vote(&bob, &1, &1, &100_000_000); // weight 10_000
    c.cast_vote(&carol, &1, &0, &900_000_000); // weight 30_000

    let opt0 = c.get_tally(&1, &0);
    assert_eq!(opt0.voter_count, 2);
    assert_eq!(opt0.stake_sum, 1_300_000_000);
    assert_eq!(opt0.weight_sum, 50_000);

    let opt1 = c.get_tally(&1, &1);
    assert_eq!(opt1.voter_count, 1);
    assert_eq!(opt1.stake_sum, 100_000_000);
    assert_eq!(opt1.weight_sum, 10_000);

    let opt2 = c.get_tally(&1, &2);
    assert_eq!(opt2.voter_count, 0);
    assert_eq!(opt2.stake_sum, 0);
    assert_eq!(opt2.weight_sum, 0);

    let poll = c.get_poll(&1).unwrap();
    assert_eq!(poll.total_voters, 3);
}

#[test]
fn cannot_vote_twice_in_same_poll() {
    let (env, c) = setup();
    let creator = Address::generate(&env);
    let voter = Address::generate(&env);
    let q = String::from_str(&env, "noon or midnight?");

    c.create_poll(&creator, &q, &2, &600);
    c.cast_vote(&voter, &1, &0, &50_000_000);

    let result = c.try_cast_vote(&voter, &1, &1, &100_000_000);
    assert!(matches!(result, Err(Ok(Error::AlreadyVoted))));

    // tallies untouched after rejection
    let opt0 = c.get_tally(&1, &0);
    assert_eq!(opt0.voter_count, 1);
    assert_eq!(opt0.stake_sum, 50_000_000);

    let opt1 = c.get_tally(&1, &1);
    assert_eq!(opt1.voter_count, 0);
    assert_eq!(opt1.stake_sum, 0);
}

#[test]
fn finalize_picks_highest_quadratic_weight() {
    let (env, c) = setup();
    let creator = Address::generate(&env);
    let whale = Address::generate(&env);
    let small_a = Address::generate(&env);
    let small_b = Address::generate(&env);
    let small_c = Address::generate(&env);
    let q = String::from_str(&env, "which proposal?");

    c.create_poll(&creator, &q, &2, &600);

    // option 0: one whale staking 900M -> weight 30_000
    c.cast_vote(&whale, &1, &0, &900_000_000);
    // option 1: three small voters at 100M each -> 3 * 10_000 = 30_001 wait
    // isqrt(100_000_000) = 10_000 each, sum = 30_000. let's make it slightly bigger
    c.cast_vote(&small_a, &1, &1, &160_000_000); // sqrt = 12_649
    c.cast_vote(&small_b, &1, &1, &160_000_000);
    c.cast_vote(&small_c, &1, &1, &160_000_000);
    // option 1 total weight: 37_947, option 0: 30_000
    // option 0 has bigger raw stake (900M) but option 1 wins on quadratic weight

    bump_time(&env, 700);
    let winner = c.finalize(&1);
    assert_eq!(winner, 1);

    let poll = c.get_poll(&1).unwrap();
    assert_eq!(poll.finalized, true);
    assert_eq!(poll.winner, 1);

    // raw stake check: option 0 has more
    let opt0 = c.get_tally(&1, &0);
    let opt1 = c.get_tally(&1, &1);
    assert!(opt0.stake_sum > opt1.stake_sum);
    assert!(opt1.weight_sum > opt0.weight_sum);
}

#[test]
fn release_stake_only_after_finalize() {
    let (env, c) = setup();
    let creator = Address::generate(&env);
    let voter = Address::generate(&env);
    let q = String::from_str(&env, "release me?");

    c.create_poll(&creator, &q, &2, &600);
    c.cast_vote(&voter, &1, &0, &81_000_000);

    // pre-finalize release fails
    let early = c.try_release_stake(&voter, &1);
    assert!(matches!(early, Err(Ok(Error::NotFinalized))));

    bump_time(&env, 700);
    c.finalize(&1);

    let stake = c.release_stake(&voter, &1);
    assert_eq!(stake, 81_000_000);

    let stored = c.get_vote(&1, &voter).unwrap();
    assert_eq!(stored.released, true);

    // double release fails
    let again = c.try_release_stake(&voter, &1);
    assert!(matches!(again, Err(Ok(Error::AlreadyReleased))));
}

#[test]
fn vote_after_deadline_fails() {
    let (env, c) = setup();
    let creator = Address::generate(&env);
    let late = Address::generate(&env);
    let q = String::from_str(&env, "too late?");

    c.create_poll(&creator, &q, &2, &60);
    bump_time(&env, 120);

    let result = c.try_cast_vote(&late, &1, &0, &10_000_000);
    assert!(matches!(result, Err(Ok(Error::PollClosed))));
}
