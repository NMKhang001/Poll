#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, String,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    StakeMustBePositive = 1,
    PollNotFound = 2,
    PollClosed = 3,
    PollNotEnded = 4,
    AlreadyFinalized = 5,
    AlreadyVoted = 6,
    OptionOutOfRange = 7,
    NotFinalized = 8,
    AlreadyReleased = 9,
    NoVoteFound = 10,
    InvalidNumOptions = 11,
    WindowMustBePositive = 12,
    NotInitialized = 13,
}

#[contracttype]
#[derive(Clone)]
pub struct Poll {
    pub id: u32,
    pub creator: Address,
    pub question: String,
    pub num_options: u32,
    pub deadline: u64,
    pub finalized: bool,
    pub winner: u32,
    pub total_voters: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Tally {
    pub weight_sum: u128,
    pub stake_sum: i128,
    pub voter_count: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Vote {
    pub option_idx: u32,
    pub stake: i128,
    pub weight: u128,
    pub released: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Token,
    PollCount,
    Poll(u32),
    Tally(u32, u32),
    Vote(u32, Address),
}

fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

fn token_addr(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Token)
        .ok_or(Error::NotInitialized)
}

#[contract]
pub struct PollHub;

#[contractimpl]
impl PollHub {
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::PollCount, &0u32);
    }

    pub fn create_poll(
        env: Env,
        creator: Address,
        question: String,
        num_options: u32,
        voting_window_secs: u64,
    ) -> Result<u32, Error> {
        creator.require_auth();
        if num_options < 2 || num_options > 6 {
            return Err(Error::InvalidNumOptions);
        }
        if voting_window_secs == 0 {
            return Err(Error::WindowMustBePositive);
        }

        let prev: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PollCount)
            .unwrap_or(0);
        let id = prev + 1;
        let deadline = env.ledger().timestamp() + voting_window_secs;

        let poll = Poll {
            id,
            creator: creator.clone(),
            question: question.clone(),
            num_options,
            deadline,
            finalized: false,
            winner: 0,
            total_voters: 0,
        };
        env.storage().persistent().set(&DataKey::Poll(id), &poll);
        env.storage().instance().set(&DataKey::PollCount, &id);

        env.events().publish(
            (symbol_short!("created"), creator),
            (id, question, num_options, deadline),
        );
        Ok(id)
    }

    pub fn cast_vote(
        env: Env,
        voter: Address,
        poll_id: u32,
        option_idx: u32,
        stake: i128,
    ) -> Result<u128, Error> {
        voter.require_auth();
        if stake <= 0 {
            return Err(Error::StakeMustBePositive);
        }

        let mut poll: Poll = env
            .storage()
            .persistent()
            .get(&DataKey::Poll(poll_id))
            .ok_or(Error::PollNotFound)?;

        if option_idx >= poll.num_options {
            return Err(Error::OptionOutOfRange);
        }
        if env.ledger().timestamp() >= poll.deadline {
            return Err(Error::PollClosed);
        }

        let vote_key = DataKey::Vote(poll_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            return Err(Error::AlreadyVoted);
        }

        // pull stake into escrow before recording any state
        let token_id = token_addr(&env)?;
        let t = token::Client::new(&env, &token_id);
        t.transfer(&voter, &env.current_contract_address(), &stake);

        let weight = isqrt(stake as u128);
        let vote = Vote {
            option_idx,
            stake,
            weight,
            released: false,
        };
        env.storage().persistent().set(&vote_key, &vote);

        let tally_key = DataKey::Tally(poll_id, option_idx);
        let mut tally: Tally = env
            .storage()
            .persistent()
            .get(&tally_key)
            .unwrap_or(Tally {
                weight_sum: 0,
                stake_sum: 0,
                voter_count: 0,
            });
        tally.weight_sum += weight;
        tally.stake_sum += stake;
        tally.voter_count += 1;
        env.storage().persistent().set(&tally_key, &tally);

        poll.total_voters += 1;
        env.storage().persistent().set(&DataKey::Poll(poll_id), &poll);

        env.events().publish(
            (symbol_short!("vote"), voter),
            (poll_id, option_idx, stake, weight),
        );
        Ok(weight)
    }

    pub fn finalize(env: Env, poll_id: u32) -> Result<u32, Error> {
        let mut poll: Poll = env
            .storage()
            .persistent()
            .get(&DataKey::Poll(poll_id))
            .ok_or(Error::PollNotFound)?;
        if poll.finalized {
            return Err(Error::AlreadyFinalized);
        }
        if env.ledger().timestamp() < poll.deadline {
            return Err(Error::PollNotEnded);
        }

        let mut winner = 0u32;
        let mut best: u128 = 0;
        for i in 0..poll.num_options {
            let t: Tally = env
                .storage()
                .persistent()
                .get(&DataKey::Tally(poll_id, i))
                .unwrap_or(Tally {
                    weight_sum: 0,
                    stake_sum: 0,
                    voter_count: 0,
                });
            if t.weight_sum > best {
                best = t.weight_sum;
                winner = i;
            }
        }

        poll.finalized = true;
        poll.winner = winner;
        let creator = poll.creator.clone();
        env.storage().persistent().set(&DataKey::Poll(poll_id), &poll);

        env.events().publish(
            (symbol_short!("final"), creator),
            (poll_id, winner, best),
        );
        Ok(winner)
    }

    pub fn release_stake(env: Env, voter: Address, poll_id: u32) -> Result<i128, Error> {
        voter.require_auth();
        let poll: Poll = env
            .storage()
            .persistent()
            .get(&DataKey::Poll(poll_id))
            .ok_or(Error::PollNotFound)?;
        if !poll.finalized {
            return Err(Error::NotFinalized);
        }

        let vote_key = DataKey::Vote(poll_id, voter.clone());
        let mut vote: Vote = env
            .storage()
            .persistent()
            .get(&vote_key)
            .ok_or(Error::NoVoteFound)?;
        if vote.released {
            return Err(Error::AlreadyReleased);
        }

        let stake = vote.stake;
        // push the stake back to the voter from escrow
        let token_id = token_addr(&env)?;
        let t = token::Client::new(&env, &token_id);
        t.transfer(&env.current_contract_address(), &voter, &stake);

        vote.released = true;
        env.storage().persistent().set(&vote_key, &vote);

        env.events().publish(
            (symbol_short!("release"), voter),
            (poll_id, stake),
        );
        Ok(stake)
    }

    pub fn poll_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PollCount)
            .unwrap_or(0)
    }

    pub fn get_poll(env: Env, poll_id: u32) -> Option<Poll> {
        env.storage().persistent().get(&DataKey::Poll(poll_id))
    }

    pub fn get_tally(env: Env, poll_id: u32, option_idx: u32) -> Tally {
        env.storage()
            .persistent()
            .get(&DataKey::Tally(poll_id, option_idx))
            .unwrap_or(Tally {
                weight_sum: 0,
                stake_sum: 0,
                voter_count: 0,
            })
    }

    pub fn get_vote(env: Env, poll_id: u32, voter: Address) -> Option<Vote> {
        env.storage()
            .persistent()
            .get(&DataKey::Vote(poll_id, voter))
    }

    pub fn token_contract(env: Env) -> Result<Address, Error> {
        token_addr(&env)
    }
}

#[cfg(test)]
mod test;
