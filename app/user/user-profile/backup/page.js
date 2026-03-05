import CommonLayout from '@/components/common/CommonLayout'
import UserProfile from '@/views/user-profile/UserProfile'
import React, { Suspense } from 'react'

const Page = () => {
  return (
    <CommonLayout>
      <div className="">
        <Suspense fallback={<div>Loading...</div>}>
          <UserProfile />
        </Suspense>
      </div>
    </CommonLayout>
  )
}

export default Page