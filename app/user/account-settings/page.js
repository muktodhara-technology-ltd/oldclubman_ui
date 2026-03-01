import CommonLayout from '@/components/common/CommonLayout'
import Settings from '@/views/settings'
import React, { Suspense } from 'react'

const AccountSettings = () => {
  return (
    <CommonLayout>
      <div className="company-page">
        <Suspense fallback={<div>Loading...</div>}>
          <Settings />
        </Suspense>
      </div>
    </CommonLayout>)
}

export default AccountSettings