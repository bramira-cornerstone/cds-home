-- Update team_rmv_per_owner view to return NULL for staked_rank when staked_rmv is 0
CREATE OR REPLACE VIEW public.team_rmv_per_owner AS
 WITH owner_values AS (
         SELECT rsj.current_owner,
            rsj.team,
            round(((sum(COALESCE(rmv.rolling_median_sale, (0)::double precision)))::numeric / '1000000000000000000'::numeric), 2) AS total_rolling_median_sale
           FROM ("RelicSerialsJoined" rsj
             JOIN "RMV" rmv ON (((rsj.edition_id)::text = (rmv.edition_id)::text)))
          WHERE (rsj.current_owner IS NOT NULL)
          GROUP BY rsj.current_owner, rsj.team
        ), owner_last_buy AS (
         SELECT lower(transfers.index_topic_2) AS owner_lcase,
            max(transfers.emitted_at) AS last_buy
           FROM transfers
          WHERE (transfers.index_topic_2 IS NOT NULL)
          GROUP BY (lower(transfers.index_topic_2))
        ), staked_values AS (
         SELECT lower(se.staker) AS staker_lcase,
            se.team,
            round(((sum(COALESCE(se.rolling_median_sale, (0)::double precision)))::numeric / '1000000000000000000'::numeric), 2) AS staked_rmv
           FROM staking se
          WHERE ((se."stakingExpiration" > now()) AND (se.staker IS NOT NULL))
          GROUP BY (lower(se.staker)), se.team
        ), staked_last_timestamp AS (
         SELECT lower(se.staker) AS staker_lcase,
            se.team,
            max(se."timestamp") AS last_staked
           FROM staking se
          WHERE (se.staker IS NOT NULL)
          GROUP BY (lower(se.staker)), se.team
        ), ranked AS (
         SELECT ov.current_owner,
            ov.team,
            ov.total_rolling_median_sale,
            olb.last_buy,
            COALESCE(sv.staked_rmv, (0)::numeric) AS staked_rmv,
            slt.last_staked,
            row_number() OVER (PARTITION BY ov.team ORDER BY ov.total_rolling_median_sale DESC, olb.last_buy) AS team_rank,
            CASE WHEN COALESCE(sv.staked_rmv, (0)::numeric) = 0 THEN NULL 
              ELSE row_number() OVER (PARTITION BY ov.team ORDER BY COALESCE(sv.staked_rmv, (0)::numeric) DESC, slt.last_staked DESC) 
            END AS staked_rank
           FROM (((owner_values ov
             LEFT JOIN owner_last_buy olb ON ((lower(ov.current_owner) = olb.owner_lcase)))
             LEFT JOIN staked_values sv ON (((lower(ov.current_owner) = sv.staker_lcase) AND (ov.team = sv.team))))
             LEFT JOIN staked_last_timestamp slt ON (((lower(ov.current_owner) = slt.staker_lcase) AND (ov.team = slt.team))))
        ), max_rank_per_team AS (
         SELECT ranked.team,
            max(ranked.team_rank) AS max_team_rank
           FROM ranked
          GROUP BY ranked.team
        )
 SELECT r.current_owner AS wallet_address,
    r.team,
    r.total_rolling_median_sale AS rmv,
    r.staked_rmv,
    r.last_buy,
    r.last_staked,
    r.team_rank,
    r.staked_rank,
    round(((((m.max_team_rank)::numeric - (r.team_rank)::numeric) + (1)::numeric) / NULLIF((m.max_team_rank)::numeric, (0)::numeric)), 4) AS percentile
   FROM (ranked r
     JOIN max_rank_per_team m ON ((((r.team IS NULL) AND (m.team IS NULL)) OR (r.team = m.team))));
