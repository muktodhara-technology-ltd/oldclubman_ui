import CommonLayout from '@/components/common/CommonLayout'
import FriendsList from '@/views/user-profile/FriendsList'
import React, { Suspense } from 'react'

const Page = () => {
  return (
    <CommonLayout>
      <div className="">
        <Suspense fallback={<div>Loading...</div>}>
          <FriendsList />
        </Suspense>
      </div>
    </CommonLayout>
  )
}

export default Page