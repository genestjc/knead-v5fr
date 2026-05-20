// app/r4town0x4mmzo/page.tsx

export default function ProposalPage() {
  return (
    <div className="bg-white min-h-screen">
      <style>{`
        .proposal {
          max-width: 7in;
          margin: 0 auto;
          padding: 0.6in 1rem;
          color: #0a0a0a;
        }

        @media print {
          .proposal { padding: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        @page { size: letter; margin: 0.75in 0.85in; }

        .p-rule { border: none; border-top: 0.5px solid #d4d4d0; margin: 0.22in 0; }

        .p-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 18px;
          border-bottom: 1px solid #d4d4d0;
          margin-bottom: 0.45in;
        }
        .p-wordmark { font-size: 42pt; letter-spacing: -0.02em; line-height: 1; color: #0a0a0a; }
        .p-header-meta { text-align: right; font-size: 8pt; color: #6b6b6b; line-height: 1.8; padding-top: 6px; }
        .p-header-meta strong { font-size: 9pt; color: #2c2c2c; display: block; margin-bottom: 2px; }

        .p-elevator { font-size: 18pt; line-height: 1.25; color: #0a0a0a; margin-bottom: 0.28in; max-width: 5.5in; letter-spacing: -0.01em; }
        .p-body { font-size: 10.5pt; color: #2c2c2c; line-height: 1.7; margin-bottom: 0.2in; max-width: 6.2in; }
        .p-body-sm { font-size: 9.5pt; color: #2c2c2c; line-height: 1.7; margin-bottom: 0.14in; max-width: 6.2in; }

        .p-label { font-size: 7.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: #6b6b6b; margin-bottom: 12px; }
        .p-heading { font-size: 13pt; color: #0a0a0a; margin-bottom: 8px; margin-top: 0.16in; }

        .p-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); border: 0.5px solid #d4d4d0; margin-bottom: 0.2in; }
        .p-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); border: 0.5px solid #d4d4d0; margin-bottom: 0.2in; }
        .p-grid-2 { display: grid; grid-template-columns: 1fr 1fr; border: 0.5px solid #d4d4d0; margin-bottom: 0.2in; }
        .p-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); border: 0.5px solid #d4d4d0; margin-bottom: 0.24in; }

        .p-cell { padding: 13px 15px; border-right: 0.5px solid #d4d4d0; }
        .p-cell:last-child { border-right: none; }
        .p-cell-label { font-size: 7pt; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6b6b; margin-bottom: 4px; }
        .p-cell-value { font-size: 14pt; color: #0a0a0a; line-height: 1.1; }
        .p-cell-value-sm { font-size: 9.5pt; color: #0a0a0a; line-height: 1.4; }
        .p-cell-sub { font-size: 7.5pt; color: #6b6b6b; margin-top: 3px; font-style: italic; line-height: 1.5; }
        .p-cell-address { font-size: 7pt; color: #6b6b6b; margin-top: 4px; line-height: 1.5; word-break: break-all; font-family: monospace; }

        .p-table { width: 100%; border-collapse: collapse; margin-bottom: 0.2in; }
        .p-table thead tr { border-bottom: 0.5px solid #d4d4d0; }
        .p-table thead th {
          font-size: 7.5pt; letter-spacing: 0.1em; text-transform: uppercase;
          color: #6b6b6b; font-weight: normal; padding: 0 0 10px 0; text-align: left;
        }
        .p-table thead th:last-child { text-align: right; }
        .p-table tbody tr { border-bottom: 0.5px solid #d4d4d0; }
        .p-table tbody tr:last-child { border-bottom: none; }
        .p-table tbody td { padding: 10px 0; font-size: 9.5pt; color: #2c2c2c; vertical-align: top; }
        .p-table tbody td:first-child { font-size: 10pt; color: #0a0a0a; width: 30%; padding-right: 16px; }
        .p-table tbody td:last-child { text-align: right; font-size: 10.5pt; color: #0a0a0a; white-space: nowrap; }

        .p-quota { margin-bottom: 0.18in; }
        .p-quota-title { font-size: 10.5pt; color: #0a0a0a; margin-bottom: 4px; }
        .p-quota-body { font-size: 9.5pt; color: #2c2c2c; line-height: 1.65; margin-bottom: 4px; }

        .p-verification {
          background: #f7f7f5;
          border-left: 2px solid #0a0a0a;
          padding: 11px 16px;
          margin-bottom: 0.28in;
          font-size: 9pt;
          color: #2c2c2c;
          line-height: 1.6;
        }

        .p-vision { margin-bottom: 0.2in; }
        .p-vision-item { display: flex; gap: 12px; margin-bottom: 10px; font-size: 9.5pt; color: #2c2c2c; line-height: 1.6; }
        .p-vision-num { font-size: 9.5pt; color: #6b6b6b; flex-shrink: 0; width: 16px; }

        .p-footer {
          border-top: 0.5px solid #d4d4d0;
          padding-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 0.3in;
        }
        .p-footer-left { font-size: 9pt; color: #0a0a0a; line-height: 1.7; }
        .p-footer-right { font-size: 8.5pt; color: #6b6b6b; text-align: right; font-style: italic; line-height: 1.7; }

        @media (max-width: 600px) {
          .p-grid-4, .p-grid-5 { grid-template-columns: 1fr 1fr; }
          .p-grid-3 { grid-template-columns: 1fr; }
          .p-grid-2 { grid-template-columns: 1fr; }
          .p-cell { border-right: none; border-bottom: 0.5px solid #d4d4d0; }
          .p-cell:last-child { border-bottom: none; }
          .p-elevator { font-size: 14pt; }
          .p-wordmark { font-size: 28pt; }
        }
      `}</style>

      <div className="proposal">

        {/* ── Header ── */}
        <div className="p-header">
          <div className="p-wordmark font-adonis">Knead</div>
          <div className="p-header-meta font-georgia-pro">
            <strong className="font-adonis">Partnership Proposal — Base</strong>
            May 2026 · Confidential
          </div>
        </div>

        {/* ── Elevator ── */}
        <p className="p-elevator font-adonis">
          Helping creators build platforms to own their media distribution.
        </p>

        {/* ── Overview ── */}
        <p className="p-body font-georgia-pro">
          Knead is a media and community platform built entirely on Web3. We believe the future of
          the internet is about owning your hub for streaming, community, and content. To help
          Towns bring more users onto it's protocol, Knead wants to partner on a business
          development strategy to onboard creators for free.
        </p>

        {/* ── How it works ── */}
        <p className="p-label font-adonis">How It Works</p>
        <p className="p-body font-georgia-pro">
          Towns pays Knead to reach out to creators and say: &ldquo;We&apos;ll build you a custom
          platform for streaming, community, and more — for free. Towns is covering the bill as
          long as it includes Towns Protocol.&rdquo;
        </p>
        <p className="p-body font-georgia-pro">
          Once the creator&apos;s solution is 80–90% complete, Knead works with Towns
          development team on a final code review to ensure accuracy.
        </p>

        <hr className="p-rule" />

        {/* ── Retainer ── */}
        <p className="p-label font-adonis">Retainer</p>
        <div className="p-grid-4">
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Monthly</div>
            <div className="p-cell-value font-adonis">$5,000</div>
            <div className="p-cell-sub font-georgia-pro">Paid in $TOWNS or USDC</div>
          </div>
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Term</div>
            <div className="p-cell-value font-adonis">6 months</div>
            <div className="p-cell-sub font-georgia-pro">Renewable by mutual agreement</div>
          </div>
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Total commitment</div>
            <div className="p-cell-value font-adonis">$30,000</div>
            <div className="p-cell-sub font-georgia-pro">Benchmark bonuses are additional</div>
          </div>
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Expenses</div>
            <div className="p-cell-value font-adonis" style={{fontSize: '11pt'}}>Included</div>
          </div>
        </div>

        <hr className="p-rule" />

        {/* ── Quotas ── */}
        <p className="p-label font-adonis">Knead Quotas</p>

        <div className="p-quota">
          <p className="p-quota-title font-adonis">4 Stories + 3 Chat Events Per Month</p>
          <p className="p-quota-body font-georgia-pro">
            Part of showcasing how Knead works to creators is continuously producing content on the
            platform ourselves. A total of seven events would host a floor of at least four
            creators, which also serve as inbound leads for creator solutions.
          </p>
          <p className="p-quota-body font-georgia-pro">
            <em>Permission to break the four stories quota must be submitted in writing one week in
            advance to Towns&apos; team, explaining what other work is being accomplished to
            overshadow content creation.</em>
          </p>
        </div>

        <div className="p-quota">
          <p className="p-quota-title font-adonis">4 Sales Leads Added Per Month to Shared Spreadsheet</p>
          <p className="p-quota-body font-georgia-pro">
            Knead is responsible for adding four sales leads per month to a spreadsheet shared with
            Towns. This means a meeting discussing a bespoke solution is on the books — ideally with
            a rough idea of execution (e.g. this musician wants a listening party; this podcaster wants
            a custom streaming platform).
          </p>
        </div>

        <div className="p-quota">
          <p className="p-quota-title font-adonis">80–90% Complete With 1 Creator by Month 3</p>
          <p className="p-quota-body font-georgia-pro">
            To deem market success, Knead must have created a custom bespoke solution for a creator
            and sent it to the Towns team for review by the end of month three.
          </p>
        </div>

        <div className="p-quota">
          <p className="p-quota-title font-adonis">80–90% Complete With 3 Creators by Month 6</p>
          <p className="p-quota-body font-georgia-pro">
            At a minimum, this engagement must bring in three creators with custom solutions within
            six months to be deemed worthwhile.
          </p>
        </div>

        <hr className="p-rule" />

        {/* ── Bonuses ── */}
        <p className="p-label font-adonis">Benchmark Bonuses</p>
        <p className="p-body-sm font-georgia-pro">
          Note: Bonus structure applies on top of the monthly retainer.
        </p>

        <p className="p-heading font-adonis">Onboarding + Solutions</p>
        <table className="p-table">
          <thead>
            <tr>
              <th className="font-adonis">Milestone</th>
              <th className="font-adonis">Description</th>
              <th className="font-adonis" style={{textAlign: 'right'}}>Bonus</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-adonis">Every Live Chat Launched</td>
              <td className="font-georgia-pro">Live Towns Protocol-powered chat.</td>
              <td className="font-adonis">$5,000</td>
            </tr>
            <tr>
              <td className="font-adonis">3 Creators on Towns Protocol</td>
              <td className="font-georgia-pro">Three creators with an active Towns Protocol-powered chat.</td>
              <td className="font-adonis">$10,000</td>
            </tr>
            <tr>
              <td className="font-adonis">5 Creators on Towns Protocol</td>
              <td className="font-georgia-pro">Five creators with an active Towns Protocol-powered chat.</td>
              <td className="font-adonis">$15,000</td>
            </tr>
          </tbody>
        </table>
        
        <hr className="p-rule" />

        {/* ── Terms ── */}
        <p className="p-label font-adonis">Terms</p>
        <div className="p-grid-5">
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Payment</div>
            <div className="p-cell-value-sm font-georgia-pro">Net-5, 1st of month in USDC</div>
          </div>
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Exit</div>
            <div className="p-cell-value-sm font-georgia-pro">7-day written notice, either party</div>
          </div>
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Equity / Tokens</div>
            <div className="p-cell-value-sm font-georgia-pro">None — retainer only</div>
          </div>
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Reporting</div>
            <div className="p-cell-value-sm font-georgia-pro">Shared business development spreadsheet + onchain metrics</div>
          </div>
          <div className="p-cell">
            <div className="p-cell-label font-adonis">Technical Support</div>
            <div className="p-cell-value-sm font-georgia-pro">Towns developer code review available upon request prior to live deployment.</div>
          </div>
        </div>

        {/* ── Verification ── */}
        <div className="p-verification font-georgia-pro">
          <strong className="font-adonis">Verification:</strong> Every placement and benchmark
          bonus is confirmed by onchain activity — wallet creation, smart contract deployment,
          transaction volume, or active community. No soft metrics. All activity publicly
          verifiable on-chain.
        </div>

        <hr className="p-rule" />

        {/* ── Footer ── */}
        <div className="p-footer">
          <div className="p-footer-left font-adonis">
            Joseph Genest<br />
            Founder, Knead<br />
            kneadmag.com
          </div>
          <div className="p-footer-right font-georgia-pro">
            Built on Towns Protocol
          </div>
        </div>

      </div>
    </div>
  )
}
