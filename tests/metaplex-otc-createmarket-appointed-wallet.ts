import * as anchor from "@project-serum/anchor";
import { Program, Wallet } from "@project-serum/anchor";
import { MplStoneage } from "../target/types/mpl_stoneage";
import {
    TOKEN_PROGRAM_ID,
    AccountLayout,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createAssociatedTokenAccount,
    MINT_SIZE,
    createInitializeAccountInstruction,
    createInitializeMintInstruction,
    setAuthority
} from '@solana/spl-token'
import * as splToken from "@solana/spl-token";
const { SystemProgram, } = anchor.web3;
import { Keypair, PublicKey } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
import { Connection, Transaction } from '@solana/web3.js';
import utils from "./util";
import { expect } from "chai";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const createTokenAccount = async ({
    payer,
    mint,
    connection,
    owner,
}) => {
    try {
        const tokenAccount = Keypair.generate();
        const createTokenTx = new Transaction();
        const accountRentExempt = await connection.getMinimumBalanceForRentExemption(AccountLayout.span);
        createTokenTx.add(
            SystemProgram.createAccount({
                fromPubkey: payer,
                newAccountPubkey: tokenAccount.publicKey,
                lamports: accountRentExempt,
                space: AccountLayout.span,
                // programId: TOKEN_PROGRAM_ID,
                programId: new anchor.web3.PublicKey(TOKEN_PROGRAM_ID),
            }),
        );

        createTokenTx.add(
            createInitializeAccountInstruction(tokenAccount.publicKey, mint, owner),
        );

        createTokenTx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
        createTokenTx.feePayer = payer;
        createTokenTx.partialSign(tokenAccount);

        return {
            tokenAccount,
            createTokenTx,
        };
    } catch (error) {
        throw error;
    }
};

describe('stoneage-createmarket-appointed-wallets', () => {
    const provider = anchor.AnchorProvider.env();
    const wallet = provider.wallet as Wallet;
    anchor.setProvider(provider);

    const program = anchor.workspace.MplStoneage as Program<MplStoneage>
    let storeGKey: anchor.web3.Keypair;

    const findTreasuryOwnerAddress = async (
        treasury_mint_keypair: anchor.web3.PublicKey,
        selling_resource_keypair: anchor.web3.PublicKey,
    ): Promise<[anchor.web3.PublicKey, number]> => {
        return (
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    anchor.utils.bytes.utf8.encode("holder"),
                    treasury_mint_keypair.toBuffer(),
                    selling_resource_keypair.toBuffer(),
                ],
                program.programId
            )
        );
    };

    const getMetadata = async (
        mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
        return (
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    anchor.utils.bytes.utf8.encode("metadata"),
                    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    mint.toBuffer(),
                ],
                TOKEN_METADATA_PROGRAM_ID
            )
        )[0];
    };

    const getMasterEdition = async (
        mint: anchor.web3.PublicKey
    ): Promise<[anchor.web3.PublicKey, number]> => {
        return (
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    anchor.utils.bytes.utf8.encode("metadata"),
                    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    mint.toBuffer(),
                    anchor.utils.bytes.utf8.encode("edition"),
                ],
                TOKEN_METADATA_PROGRAM_ID
            )
        );
    };

    it("Create store!", async () => {
        // metaplex address on devnet
        const storeKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();
        const adminKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();
        storeGKey = storeKey;
        console.log("wallet.publicKey ", wallet.publicKey.toString());
        console.log("storeKey.publicKey ", storeKey.publicKey.toString());
        console.log("storeKey: ", storeKey.publicKey.toBase58());

        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(adminKey.publicKey, 10000000000),
            "confirmed"
        );

        await program.rpc.createStore("store_1", "test store", {
            accounts: {
                admin: wallet.publicKey,
                store: storeKey.publicKey,
                systemProgram: SystemProgram.programId,
            },
            signers: [storeKey],
        });

        // get store info to double check
        const storeData = await program.account.store.fetch(storeKey.publicKey);
    });

    it("Initselling resource + create Market + buy with appointed_wallets!", async () => {
        let [NFTOne, exchangeTo] = await utils.generateData();
        const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
            "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        );
        const lamports: number = await program.provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);

        // shitty code
        let storeKey = new PublicKey("G6NL2KSQwYEK9p6BWbwerXHYbwUnHVFQPZLcYP7z4nHb");

        // const NFTOne = require("./minted_nfts/nft_6.json");
        // const exchangeTo = require("./minted_nfts/nft_8.json");
        const mintPubkey = new PublicKey(NFTOne.mint_key);
        
        const exchangeMintPubkey = new PublicKey(exchangeTo.mint_key);
        const exchangeResourceToken = new PublicKey(exchangeTo.nft_account);

        const resourceToken = new PublicKey(NFTOne.nft_account);
        const sellingResourceKeypair: anchor.web3.Keypair = anchor.web3.Keypair.generate();

        const getVault = async (
            mint: anchor.web3.PublicKey,
            store: anchor.web3.PublicKey,
        ): Promise<[anchor.web3.PublicKey, number]> => {
            return (
                await anchor.web3.PublicKey.findProgramAddress(
                    [
                        anchor.utils.bytes.utf8.encode("mt_vault"),
                        mint.toBuffer(),
                        store.toBuffer(),
                    ],
                    program.programId
                )
            );
        };

        console.log("program.programId ", program.programId.toBase58())
        const getHistory = async (
            payer: anchor.web3.PublicKey,
            market: anchor.web3.PublicKey,
        ): Promise<[anchor.web3.PublicKey, number]> => {
            return (
                await anchor.web3.PublicKey.findProgramAddress(
                    [
                        anchor.utils.bytes.utf8.encode("history"),
                        payer.toBuffer(),
                        market.toBuffer(),
                    ],
                    program.programId
                )
            );
        };

        const [masterEdition, master_edition_bump] = await getMasterEdition(mintPubkey);
        await delay(1000);
        /**
         * create an token account and assign the owner to vaultOwner, vaultOwnerBump
         */
        console.log("storeKey ", storeKey.toBase58());
        const [vaultOwner, vaultOwnerBump] = await getVault(mintPubkey, storeKey);
        console.log(vaultOwner.toBase58());
        await delay(1000);
        const metadataAddress = await getMetadata(mintPubkey);

        try {
            const { tokenAccount: vault, createTokenTx } = await createTokenAccount({
                payer: wallet.publicKey,
                mint: mintPubkey,
                connection: program.provider.connection,
                owner: vaultOwner,
            });
            await delay(1000);
            let res = await program.provider.sendAndConfirm(createTokenTx, [vault]);
            console.log("create token response ", res);
            console.log(vault.publicKey.toBase58())

            // create_market
            const marketKeyPair = Keypair.generate();

            // for storing market fee
            const treasureMint = Keypair.generate();

            let [treasury_owner, treasury_owner_bump] = await findTreasuryOwnerAddress(
                treasureMint.publicKey,
                sellingResourceKeypair.publicKey
            );
            await delay(1000);
            const initTreasureTx = new anchor.web3.Transaction().add(
                anchor.web3.SystemProgram.createAccount({
                    fromPubkey: wallet.publicKey,
                    newAccountPubkey: treasureMint.publicKey,
                    space: MINT_SIZE,
                    programId: TOKEN_PROGRAM_ID,
                    lamports,
                }),
                createInitializeMintInstruction(
                    treasureMint.publicKey,
                    0,
                    wallet.publicKey,
                    wallet.publicKey
                ),

            );

            await program.provider.sendAndConfirm(initTreasureTx, [treasureMint]);
            await delay(1000);
            const { tokenAccount: treasureHolder, createTokenTx: initTreasureHolderTx } = await createTokenAccount({
                payer: wallet.publicKey,
                mint: treasureMint.publicKey,
                connection: program.provider.connection,
                owner: treasury_owner,
            });

            await program.provider.sendAndConfirm(initTreasureHolderTx, [treasureHolder]);
            const startDate = Math.round(Date.now() / 1000) + 10;
            const endDate =  startDate + 5 * 20;
            const { tokenAccount: vaultReceiver, createTokenTx: creatExchangeTokeAccTx } = await createTokenAccount({
                payer: wallet.publicKey,
                mint: exchangeMintPubkey,
                connection: program.provider.connection,
                owner: vaultOwner,
            });

            res = await program.provider.sendAndConfirm(creatExchangeTokeAccTx, [vaultReceiver]);
            let appointed_wallet = Keypair.generate();
            
            let response = await program.rpc.createMarket(
                vaultOwnerBump,
                "Dep trai co gi sai",
                "Dep trai co gi sai",
                true,
                [exchangeMintPubkey, exchangeMintPubkey],
                [vaultReceiver.publicKey, vaultReceiver.publicKey],
                [appointed_wallet.publicKey],
                new anchor.BN(startDate),
                new anchor.BN(endDate),
                {
                    accounts: {
                        market: marketKeyPair.publicKey,
                        store: storeKey,
                        admin: wallet.publicKey,

                        resourceToken: resourceToken,
                        mint: mintPubkey,

                        // resourceMint: mintPubkey,
                        masterEdition,
                        metadata: metadataAddress,
                        vault: vault.publicKey,
                        owner: vaultOwner,
                        
                        tokenProgram: TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    },
                    instructions: [
                        await program.account.market.createInstruction(
                            marketKeyPair,
                            500
                        ),
                      ],
                    signers: [marketKeyPair, wallet.payer],
                }
            );
            await delay(2000);

            const marketData = await program.account.market.fetch(marketKeyPair.publicKey);
            console.log("marketData ", marketData);
            
            // buy
            let buyer = anchor.web3.Keypair.generate();
            await provider.connection.confirmTransaction(
                await provider.connection.requestAirdrop(buyer.publicKey, 10000000000),
                "confirmed"
            );
            
            let [trade_history, trade_history_bump] = await getHistory(buyer.publicKey, marketKeyPair.publicKey);
            
            // account for storing swapped token
            // let buyerReceiverTokenAccount = anchor.web3.Keypair.generate();
            
            // TODO init token account for receiver token
            const { tokenAccount: buyerReceiverTokenAccount, createTokenTx: createBuyerReceiverTx } = await createTokenAccount({
                payer: wallet.publicKey,
                mint: mintPubkey,
                connection: program.provider.connection,
                owner: wallet.publicKey,
            });
            await delay(1000);
            res = await program.provider.sendAndConfirm(createBuyerReceiverTx, [buyerReceiverTokenAccount]);
            const [exchangeMasterEdition, exchange_master_edition_bump] = await getMasterEdition(exchangeMintPubkey);
            const exchangeMetadataAddress = await getMetadata(exchangeMintPubkey);

            await delay(1000);
            try {
                let buyErrorResponse = await program.rpc.buy(
                    vaultOwnerBump,
                    {
                        accounts: {
                            market: marketKeyPair.publicKey,
                            buyerWallet: wallet.publicKey,
                            buyerExchangeTokenAccount: exchangeResourceToken,
                            buyerExchangeResourceMint: exchangeMintPubkey,
                            buyerReceiverTokenAccount: buyerReceiverTokenAccount.publicKey,
                            vaultTokenAccount: vaultReceiver.publicKey,
                            treasuryHolder: treasureHolder.publicKey,
                            masterEdition : exchangeMasterEdition,
                            metadata: exchangeMetadataAddress,
                            vault: vault.publicKey,
                            owner: vaultOwner,
                            admin: wallet.publicKey,
                            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            systemProgram: SystemProgram.programId,
                            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY
                        },
                        signers: [wallet.payer],
                    }
                )
            } catch (ex) {
                expect(ex.error.errorCode.code).eq("NotAppointedBuyer");
                expect(ex.error.errorCode.number).eq(6046);
            }
            
            await delay(1000);

            // buy with appointed_wallet
            // transfer authority of token to appoint_wallet
            let authorityRes = await setAuthority(
                program.provider.connection,
                wallet.payer,
                exchangeResourceToken,
                wallet.publicKey,
                splToken.AuthorityType.AccountOwner,
                appointed_wallet.publicKey
            )

            // send some sol to appointed_wallet
            var transaction = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: appointed_wallet.publicKey,
                    lamports: web3.LAMPORTS_PER_SOL / 10,
                })
            );
            await delay(1000);
            // Sign transaction, broadcast, and confirm
            var signature = await web3.sendAndConfirmTransaction(
                program.provider.connection,
                transaction,
                [wallet.payer]
            );

            await delay(1000);
            // use appointed_wallet to be buyer
            let buySuccessResponse = await program.rpc.buy(
                vaultOwnerBump,
                {
                    accounts: {
                        market: marketKeyPair.publicKey,
                        buyerWallet: appointed_wallet.publicKey,
                        buyerExchangeTokenAccount: exchangeResourceToken,
                        buyerExchangeResourceMint: exchangeMintPubkey,
                        buyerReceiverTokenAccount: buyerReceiverTokenAccount.publicKey,
                        vaultTokenAccount: vaultReceiver.publicKey,
                        treasuryHolder: treasureHolder.publicKey,
                        masterEdition : exchangeMasterEdition,
                        metadata: exchangeMetadataAddress,
                        vault: vault.publicKey,
                        owner: vaultOwner,
                        admin: wallet.publicKey,
                        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY
                    },
                    signers: [appointed_wallet],
                }
            )
        } catch (ex) {
            console.log(ex);
            console.log(ex.error);
        }
    });
});