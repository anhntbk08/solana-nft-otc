use anchor_lang::prelude::*;
use crate::{
    state::{MarketState},
    utils::*,
    CloseMarket
};
use anchor_spl::token;

impl<'info> CloseMarket<'info> {
    pub fn process(&mut self, vault_owner_bump: u8) -> Result<()> {
        let market = &mut self.market;

        let vault = &self.vault;
        let metadata = &self.metadata;
        let vault_owner = &self.owner;
        let destination = &self.destination;
        let token_program = &self.token_program;

        // Check, that provided metadata is correct
        assert_derivation(
            &mpl_token_metadata::id(),
            metadata,
            &[
                mpl_token_metadata::state::PREFIX.as_bytes(),
                mpl_token_metadata::id().as_ref(),
                market.resource.as_ref(),
            ],
        )?;

        let signer_seeds: &[&[&[u8]]] = &[&[
            VAULT_OWNER_PREFIX.as_bytes(),
            market.resource.as_ref(),
            market.store.as_ref(),
            &[vault_owner_bump],
        ]];

        // Transfer token(ownership)
        let cpi_program = token_program.to_account_info();
        let cpi_accounts = token::Transfer {
            from: vault.to_account_info(),
            to: destination.to_account_info(),
            authority: vault_owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::transfer(cpi_ctx, 1)?;

        market.state = MarketState::Ended;

        Ok(())
    }
}
